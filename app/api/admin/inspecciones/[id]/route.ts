import { normalizeSchedule } from "@/lib/inspection/schedule";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

// parser robusto del id (params o pathname)
function parseInspeccionId(req: NextRequest, params?: { id?: string }) {
  const fromParams = params?.id;
  const fromPath = req.nextUrl.pathname.split("/").filter(Boolean).pop();
  const raw = (fromParams ?? fromPath ?? "").trim();
  const onlyDigits = raw.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

// ✅ IMPORTANTE: en tu Next, params viene como Promise
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const inspeccionId = parseInspeccionId(req, { id });

    if (!inspeccionId) {
      return NextResponse.json({ ok: false, error: "id inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const action = (body as any).action;
    const pool = await getPool();

    // Debe existir y ser PROGRAMADA
    const current = await pool
      .request()
      .input("id", inspeccionId)
      .query(`
        SELECT id, estado
        FROM public.inspecciones
        WHERE id = @id
       LIMIT 1`);

    if (current.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspección no existe" }, { status: 404 });
    }

    const estadoActual = String(current.recordset[0].estado);
    if (estadoActual !== "PROGRAMADA") {
      return NextResponse.json(
        { ok: false, error: "Solo se puede modificar una inspección PROGRAMADA" },
        { status: 409 }
      );
    }

    // ✅ CANCELAR
    if (action === "CANCELAR") {
      await pool
        .request()
        .input("id", inspeccionId)
        .query(`
          UPDATE public.inspecciones
          SET estado = 'CANCELADA'
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true });
    }

    // ✅ REAGENDAR
    if (action === "REAGENDAR") {
      const fechaLocal = normalizeSchedule((body as any).fechaProgramada);
      const obs =
        typeof (body as any).observaciones === "string"
          ? (body as any).observaciones.trim()
          : null;

      const inspectorIdRaw = (body as any).inspectorId;
      const inspectorId =
        inspectorIdRaw === null || inspectorIdRaw === undefined || inspectorIdRaw === ""
          ? null
          : Number(inspectorIdRaw);

      if (!fechaLocal) {
        return NextResponse.json({ ok: false, error: "Selecciona una fecha de inspección válida" }, { status: 400 });
      }
      if (inspectorId !== null && (!Number.isInteger(inspectorId) || inspectorId <= 0)) {
        return NextResponse.json({ ok: false, error: "inspectorId inválido" }, { status: 400 });
      }

      const fechaSql = fechaLocal; // YYYY-MM-DD HH:mm:00

      // Validar inspector si viene
      if (inspectorId !== null) {
        const insp = await pool
          .request()
          .input("id", inspectorId)
          .query(`
            SELECT id
            FROM public.usuarios
            WHERE id = @id
              AND COALESCE(activo, FALSE) = TRUE
              AND LOWER(LTRIM(RTRIM(rol))) = 'inspector'
           LIMIT 1`);

        if (insp.recordset.length === 0) {
          return NextResponse.json(
            { ok: false, error: "Inspector no existe o no está activo" },
            { status: 404 }
          );
        }
      }

      // Interpretar datetime-local en Chile, independientemente del servidor.
      const validation = await pool.request().input("fecha", fechaSql).query(`
        SELECT CAST(@fecha AS date) >= CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS date) AS valid
      `);
      if (!validation.recordset[0]?.valid) {
        return NextResponse.json({ ok: false, error: "La fecha debe ser hoy o posterior" }, { status: 400 });
      }

      await pool
        .request()
        .input("id", inspeccionId)
        .input("fecha", fechaSql)
        .input("inspectorId", inspectorId)
        .input("obs", obs)
        .query(`
          UPDATE public.inspecciones
          SET
            fecha_programada = (CAST(@fecha AS timestamp) AT TIME ZONE 'America/Santiago'),
            fecha_inspeccion = NULL,
            inspector_id = @inspectorId,
            observaciones_generales = COALESCE(NULLIF(@obs, ''), observaciones_generales)
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/admin/inspecciones/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
