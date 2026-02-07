import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import { z } from "zod";

// ==========================================
// VALIDACIONES (ZOD)
// ==========================================
const CreateAgendaSchema = z.object({
  camionId: z.coerce.number().positive(),
  inspectorId: z.coerce.number().optional().nullable(),
  fechaProgramada: z.string().min(1, "Fecha requerida"), // Espera formato ISO "YYYY-MM-DDTHH:mm"
  observaciones: z.string().optional().nullable(),
});

// ==========================================
// GET: Listado de Camiones y sus Agendas
// ==========================================
export async function GET(req: NextRequest) {
  try {
    // 1. Seguridad
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    // 2. Filtros URL
    const { searchParams } = new URL(req.url);
    const estado = (searchParams.get("estado") || "SIN_AGENDA").toUpperCase();
    const patente = searchParams.get("patente")?.trim().toUpperCase();

    const pool = await getPool();
    const request = pool.request();
    const whereConditions: string[] = [];

    // 3. Filtro Patente
    if (patente) {
      request.input("patente", `%${patente}%`);
      whereConditions.push("c.patente LIKE @patente");
    }

    // 4. Lógica de Estados (Zona Horaria Chile)
    // Esto asegura que "HOY" sea realmente hoy en Chile, no en Londres (UTC)
    if (estado === "SIN_AGENDA") {
      whereConditions.push("ip.id IS NULL");
    } else if (estado === "PROGRAMADA") {
      whereConditions.push("ip.id IS NOT NULL");
      whereConditions.push("ip.fecha_programada >= CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATETIME)");
    } else if (estado === "VENCIDA") {
      whereConditions.push("ip.id IS NOT NULL");
      whereConditions.push("ip.fecha_programada < CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATETIME)");
    }

    // 5. Consulta SQL Optimizada
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

        ip.id           AS inspeccion_id,
        ip.fecha_programada,
        ip.inspector_id,
        u.nombre        AS inspector_nombre

      FROM dbo.camiones c
      INNER JOIN dbo.proveedores p ON p.id = c.proveedor_id
      INNER JOIN dbo.empresas e    ON e.id = p.empresa_id

      -- Busca la última inspección activa ('PROGRAMADA')
      OUTER APPLY (
        SELECT TOP 1 i.id, i.fecha_programada, i.inspector_id
        FROM dbo.inspecciones i
        WHERE i.camion_id = c.id
          AND i.estado = 'PROGRAMADA'
        ORDER BY i.fecha_programada DESC
      ) ip

      LEFT JOIN dbo.usuarios u ON u.id = ip.inspector_id

      ${whereConditions.length ? "WHERE " + whereConditions.join(" AND ") : ""}
      
      ORDER BY 
        CASE WHEN ip.fecha_programada IS NOT NULL THEN ip.fecha_programada ELSE c.created_at END DESC
    `;

    const result = await request.query(query);

    // 6. Formateo de respuesta
    const now = new Date();
    
    const camiones = result.recordset.map((row: any) => {
      let ui_estado = "SIN_AGENDA";
      const fechaProg = row.fecha_programada ? new Date(row.fecha_programada) : null;

      if (fechaProg) {
        ui_estado = fechaProg >= now ? "PROGRAMADA" : "VENCIDA";
      }

      return {
        id: row.camion_id,
        patente: row.patente,
        marca: row.marca,
        modelo: row.modelo,
        anio: row.anio,
        tipo: row.tipo,
        carroceria: row.carroceria,
        createdAt: row.created_at,

        empresa: {
          id: row.empresa_id,
          nombre: row.empresa_nombre,
          rut: row.empresa_rut,
        },

        ui_estado, 

        inspeccionProgramada: row.inspeccion_id
          ? {
              id: row.inspeccion_id,
              fechaProgramada: row.fecha_programada ? new Date(row.fecha_programada).toISOString() : null,
              inspector: row.inspector_id
                ? { id: row.inspector_id, nombre: row.inspector_nombre }
                : null,
            }
          : null,
      };
    });

    return NextResponse.json({ ok: true, camiones });

  } catch (error: any) {
    console.error("GET /api/admin/inspecciones error:", error);
    return NextResponse.json({ ok: false, error: "Error al cargar datos" }, { status: 500 });
  }
}

// ==========================================
// POST: Crear Agenda (¡Ahora funciona 100%!)
// ==========================================
export async function POST(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    
    // 1. Validar datos
    const parsed = CreateAgendaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    }

    const { camionId, inspectorId, fechaProgramada, observaciones } = parsed.data;

    const pool = await getPool();
    const trans = new sql.Transaction(pool);
    
    try {
      await trans.begin();
      const reqTrans = trans.request();

      // 2. Verificar duplicados
      const check = await reqTrans
        .input("checkCamionId", camionId)
        .query("SELECT TOP 1 id FROM dbo.inspecciones WHERE camion_id = @checkCamionId AND estado = 'PROGRAMADA'");
      
      if (check.recordset.length > 0) {
        await trans.rollback();
        return NextResponse.json({ ok: false, error: "El camión ya tiene una inspección programada activa." }, { status: 400 });
      }

      // 3. Insertar Inspección
      // NOTA: 'fecha_inspeccion' es obligatorio en tu BD.
      // Lo rellenamos con la misma fecha programada para cumplir la regla,
      // pero el resultado 'PENDIENTE' indica que aún no se ha hecho.
      await reqTrans
        .input("camionId", camionId)
        .input("inspectorId", inspectorId ?? null)
        .input("fechaProgramada", new Date(fechaProgramada))
        .input("obs", observaciones ?? null)
        .query(`
          INSERT INTO dbo.inspecciones 
            (camion_id, inspector_id, fecha_programada, fecha_inspeccion, estado, resultado_general, observaciones_generales)
          VALUES 
            (@camionId, @inspectorId, @fechaProgramada, @fechaProgramada, 'PROGRAMADA', 'PENDIENTE', @obs)
        `);

      await trans.commit();
      return NextResponse.json({ ok: true, message: "Inspección agendada correctamente" });

    } catch (err) {
      await trans.rollback();
      throw err;
    }

  } catch (error: any) {
    console.error("POST /api/admin/inspecciones error:", error);
    // Manejo específico del error Check Constraint (por si acaso alguien revierte tu cambio en la BD)
    if (error.message?.includes("CK_inspecciones_resultado")) {
        return NextResponse.json({ ok: false, error: "La base de datos rechaza el estado 'PENDIENTE'. Verifica el constraint." }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: error.message || "Error al agendar" }, { status: 500 });
  }
}