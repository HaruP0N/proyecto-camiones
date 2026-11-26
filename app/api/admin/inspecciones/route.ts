import { normalizeSchedule } from "@/lib/inspection/schedule";
import { NextRequest, NextResponse } from "next/server";
import { getPool, Transaction } from "@/lib/database";
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
      // Consideramos el día completo en zona Chile (no solo la hora)
      whereConditions.push("CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS DATE) >= CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS DATE)");
    } else if (estado === "VENCIDA") {
      whereConditions.push("ip.id IS NOT NULL");
      whereConditions.push("CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS DATE) < CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS DATE)");
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

        CASE WHEN ip.id IS NULL THEN 'SIN_AGENDA'
          WHEN CAST(ip.fecha_programada AT TIME ZONE 'America/Santiago' AS date) < CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date)
          THEN 'VENCIDA' ELSE 'PROGRAMADA' END AS ui_estado,
        ip.id           AS inspeccion_id,
        ip.fecha_programada,
        ip.inspector_id,
        u.nombre        AS inspector_nombre

      FROM public.camiones c
      INNER JOIN public.proveedores p ON p.id = c.proveedor_id
      INNER JOIN public.empresas e    ON e.id = p.empresa_id

      -- Busca la última inspección activa ('PROGRAMADA')
      LEFT JOIN LATERAL (
        SELECT i.id, i.fecha_programada, i.inspector_id
        FROM public.inspecciones i
        WHERE i.camion_id = c.id
          AND i.estado = 'PROGRAMADA'
        ORDER BY i.fecha_programada DESC LIMIT 1
      ) ip ON TRUE

      LEFT JOIN public.usuarios u ON u.id = ip.inspector_id

      ${whereConditions.length ? "WHERE " + whereConditions.join(" AND ") : ""}

      ORDER BY
        CASE WHEN ip.fecha_programada IS NOT NULL THEN ip.fecha_programada ELSE c.created_at END DESC
    `;

    const result = await request.query(query);

    const camiones = result.recordset.map((row: any) => {
      const ui_estado = row.ui_estado;
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

    const { camionId, inspectorId, observaciones } = parsed.data;
    const fechaProgramada = normalizeSchedule(parsed.data.fechaProgramada);
    if (!fechaProgramada) return NextResponse.json({ ok: false, error: "Selecciona una fecha de inspección válida" }, { status: 400 });

    const pool = await getPool();
    const trans = new Transaction(pool);

    try {
      await trans.begin();
      const reqTrans = trans.request();

      const valid = await trans.request().input("fecha", fechaProgramada).query("SELECT CAST(@fecha AS date) >= CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date) AS valid");
      if (!valid.recordset[0]?.valid) {
        await trans.rollback();
        return NextResponse.json({ ok: false, error: "La fecha debe ser hoy o posterior" }, { status: 400 });
      }
      const truck = await trans.request().input("id", camionId).query("SELECT id FROM camiones WHERE id=@id FOR UPDATE");
      if (!truck.recordset.length) {
        await trans.rollback();
        return NextResponse.json({ ok: false, error: "Camión no encontrado" }, { status: 404 });
      }
      if (inspectorId != null) {
        const inspector = await trans.request().input("id", inspectorId).query("SELECT id FROM usuarios WHERE id=@id AND activo=TRUE AND rol='inspector'");
        if (!inspector.recordset.length) {
          await trans.rollback();
          return NextResponse.json({ ok: false, error: "Inspector no existe o no está activo" }, { status: 400 });
        }
      }
      // 2. Verificar duplicados
      const check = await reqTrans
        .input("checkCamionId", camionId)
        .query("SELECT id FROM public.inspecciones WHERE camion_id = @checkCamionId AND estado = 'PROGRAMADA' LIMIT 1");

      if (check.recordset.length > 0) {
        await trans.rollback();
        return NextResponse.json({ ok: false, error: "El camión ya tiene una inspección programada activa." }, { status: 400 });
      }

      // 3. Insertar Inspección
      await reqTrans
        .input("camionId", camionId)
        .input("inspectorId", inspectorId ?? null)
        .input("fechaProgramada", fechaProgramada)
        .input("obs", observaciones ?? null)
        .query(`
          INSERT INTO public.inspecciones
            (camion_id, inspector_id, fecha_programada, fecha_inspeccion, estado, resultado_general, observaciones_generales)
          VALUES
            (@camionId, @inspectorId, (CAST(@fechaProgramada AS timestamp) AT TIME ZONE 'America/Santiago'), NULL, 'PROGRAMADA', 'PENDIENTE', @obs)
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
