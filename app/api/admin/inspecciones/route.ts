import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      server: process.env.AZURE_SQL_SERVER!,
      database: process.env.AZURE_SQL_DATABASE!,
      options: { encrypt: true, trustServerCertificate: false },
      connectionTimeout: 30000,
      requestTimeout: 30000,
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    }).connect();
  }
  return poolPromise;
}

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
      request.input("patente", sql.VarChar(20), normalizePatente(patente));
      where.push("c.patente = @patente");
    }

    // 👇 Filtrado por estado ya en SQL (mejor performance)
    // Nota: comparo con SYSDATETIME() (hora del servidor SQL). Sin timezone, consistente.
    if (estado === "SIN_AGENDA") {
      where.push("ip.id IS NULL");
    } else if (estado === "PROGRAMADA") {
      where.push("ip.id IS NOT NULL AND ip.fecha_programada >= SYSDATETIME()");
    } else if (estado === "VENCIDA") {
      where.push("ip.id IS NOT NULL AND ip.fecha_programada < SYSDATETIME()");
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
        CONVERT(varchar(16), c.created_at, 126) AS created_at_local,

        e.id            AS empresa_id,
        e.nombre        AS empresa_nombre,
        e.rut           AS empresa_rut,
        e.email_contacto,
        e.telefono_contacto,

        ip.id           AS inspeccion_id,
        CONVERT(varchar(16), ip.fecha_programada, 126) AS fecha_programada_local,
        ip.inspector_id,
        u.nombre        AS inspector_nombre

      FROM dbo.camiones c
      JOIN dbo.proveedores p ON p.id = c.proveedor_id
      JOIN dbo.empresas e ON e.id = p.empresa_id

      OUTER APPLY (
        SELECT TOP 1 i.*
        FROM dbo.inspecciones i
        WHERE i.camion_id = c.id
          AND i.estado = 'PROGRAMADA'
        ORDER BY i.fecha_programada DESC
      ) ip

      LEFT JOIN dbo.usuarios u ON u.id = ip.inspector_id

      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.created_at DESC
    `;

    const r = await request.query(query);

    // ✅ Ya no necesito "now" para filtrar, pero sí para construir ui_estado de manera consistente.
    // Uso la misma lógica que SQL (SYSDATETIME). Como no puedo leer SYSDATETIME() en node,
    // lo calculo igual que antes para la UI. Esto NO afecta filtro (ya filtró SQL).
    const now = new Date();

    const camiones = r.recordset.map((row: any) => {
      const fechaStr: string | null = row.fecha_programada_local ?? null;

      let ui_estado: "SIN_AGENDA" | "PROGRAMADA" | "VENCIDA" = "SIN_AGENDA";
      if (fechaStr) {
        const d = new Date(fechaStr); // "YYYY-MM-DDTHH:mm" -> local
        ui_estado = d.getTime() >= now.getTime() ? "PROGRAMADA" : "VENCIDA";
      }

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
    console.error("GET /api/admin/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
