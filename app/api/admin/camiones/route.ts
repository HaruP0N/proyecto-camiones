import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/staff-auth";

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

    /**
     * Asumimos que en dbo.inspecciones tienes al menos:
     * - camion_id
     * - fecha_inspeccion (o fecha_programada si la tuya se llama distinto)
     *
     * En tu captura anterior aparecía "fecha_inspe..." => usaremos fecha_inspeccion.
     * Si en tu BD se llama distinto, dime el nombre y lo ajusto en 1 línea.
     */

    const query = `
      SELECT
        c.id            AS camion_id,
        c.patente,
        c.marca,
        c.modelo,
        c.anio,
        c.tipo,
        c.carroceria,
        c.created_at,

        e.id            AS empresa_id,
        e.nombre        AS empresa_nombre,
        e.rut           AS empresa_rut,
        e.email_contacto,
        e.telefono_contacto,

        ip.id           AS inspeccion_id,
        ip.fecha_inspeccion AS fecha_programada,
        ip.inspector_id

      FROM dbo.camiones c
      JOIN dbo.proveedores p ON p.id = c.proveedor_id
      JOIN dbo.empresas e ON e.id = p.empresa_id

      OUTER APPLY (
        SELECT TOP 1 i.*
        FROM dbo.inspecciones i
        WHERE i.camion_id = c.id
        ORDER BY i.fecha_inspeccion DESC
      ) ip

      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY c.created_at DESC
    `;

    const r = await request.query(query);

    const now = new Date();

    const camiones = r.recordset.map((row: any) => {
      const fecha = row.fecha_programada ? new Date(row.fecha_programada) : null;

      let ui_estado: "SIN_AGENDA" | "PROGRAMADA" | "VENCIDA" = "SIN_AGENDA";
      if (fecha) {
        ui_estado = fecha.getTime() >= now.getTime() ? "PROGRAMADA" : "VENCIDA";
      }

      return {
        id: row.camion_id,
        patente: row.patente,
        marca: row.marca ?? null,
        modelo: row.modelo ?? null,
        anio: row.anio ?? null,
        tipo: row.tipo ?? null,
        carroceria: row.carroceria ?? null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,

        // ✅ ahora sí nombre real de empresas
        empresa: {
          id: row.empresa_id,
          nombre: row.empresa_nombre ?? null,
          rut: row.empresa_rut ?? null,
          email: row.email_contacto ?? null,
          telefono: row.telefono_contacto ?? null,
        },

        ui_estado,
        inspeccionProgramada: row.inspeccion_id
          ? {
              id: row.inspeccion_id,
              fechaProgramada: row.fecha_programada ? new Date(row.fecha_programada).toISOString() : null,
              inspector: row.inspector_id ? { id: row.inspector_id, nombre: null } : null,
            }
          : null,
      };
    });

    // ✅ Filtrar según tab de verdad
    const filtered = camiones.filter((c: any) => c.ui_estado === estado);

    return NextResponse.json({ ok: true, camiones: filtered }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/camiones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
