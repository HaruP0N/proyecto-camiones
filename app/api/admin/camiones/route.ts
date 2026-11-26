import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

function normalizePatente(p: string) {
  return p.trim().toUpperCase().replace(/\s+/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const estado = (searchParams.get("estado") || "SIN_AGENDA").toUpperCase();
    const patente = searchParams.get("patente");

    if (!["SIN_AGENDA", "PROGRAMADA", "VENCIDA"].includes(estado)) {
      return NextResponse.json({ ok: false, error: "estado inválido" }, { status: 400 });
    }

    const pool = await getPool();
    const request = pool.request();

    const where: string[] = [];

    if (patente) {
      request.input("patente", normalizePatente(patente));
      where.push("c.patente = @patente");
    }

    // 👇 Filtrado por estado ya en SQL (mejor performance)
    // Comparar por día en Chile, tanto para el filtro como para la etiqueta.
    if (estado === "SIN_AGENDA") {
      where.push("ip.id IS NULL");
    } else if (estado === "PROGRAMADA") {
      where.push("ip.id IS NOT NULL AND CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS date) >= CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date)");
    } else if (estado === "VENCIDA") {
      where.push("ip.id IS NOT NULL AND CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS date) < CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date)");
    }

    const query = `
      SELECT
        c.id            AS camion_id,
        c.patente,
        c.marca,
        c.modelo,
        c.anio,
        c.tipo,
        c.carroceria,
        to_char(c.created_at AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at_local,

        e.id            AS empresa_id,
        e.nombre        AS empresa_nombre,
        e.rut           AS empresa_rut,
        e.email_contacto,
        e.telefono_contacto,

        CASE WHEN ip.id IS NULL THEN 'SIN_AGENDA'
          WHEN CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS date) < CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date)
          THEN 'VENCIDA' ELSE 'PROGRAMADA' END AS ui_estado,
        ip.id           AS inspeccion_id,
        to_char(ip.fecha_programada AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') AS fecha_programada_local,
        ip.inspector_id,
        u.nombre        AS inspector_nombre

      FROM public.camiones c
      JOIN public.proveedores p ON p.id = c.proveedor_id
      JOIN public.empresas e ON e.id = p.empresa_id

      LEFT JOIN LATERAL (
        SELECT i.*
        FROM public.inspecciones i
        WHERE i.camion_id = c.id
          AND i.estado = 'PROGRAMADA'
        ORDER BY i.fecha_programada DESC LIMIT 1
      ) ip ON TRUE

      LEFT JOIN public.usuarios u ON u.id = ip.inspector_id

      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.created_at DESC
    `;

    const r = await request.query(query);

    const camiones = r.recordset.map((row: any) => {
      const ui_estado = row.ui_estado;
      const fechaStr: string | null = row.fecha_programada_local ?? null;
      return {
        id: Number(row.camion_id),
        patente: row.patente,
        marca: row.marca ?? null,
        modelo: row.modelo ?? null,
        anio: row.anio ?? null,
        tipo: row.tipo ?? null,
        carroceria: row.carroceria ?? null,
        createdAt: row.created_at_local ?? null,

        empresa: {
          id: Number(row.empresa_id),
          nombre: row.empresa_nombre ?? null,
          rut: row.empresa_rut ?? null,
          email: row.email_contacto ?? null,
          telefono: row.telefono_contacto ?? null,
        },

        ui_estado,

        inspeccionProgramada: row.inspeccion_id
          ? {
              id: Number(row.inspeccion_id),
              fechaProgramada: row.fecha_programada_local ?? null,
              inspector: row.inspector_id
                ? { id: Number(row.inspector_id), nombre: row.inspector_nombre ?? null }
                : null,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, camiones }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/camiones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
