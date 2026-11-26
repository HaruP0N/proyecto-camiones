import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireInspector } from "@/lib/shared/security/staff-auth";
import { saveInspection, InspectionError } from "@/lib/inspection/save";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = requireInspector(req);
  if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  try {
    const body = await req.json();
    const inspeccionId = await saveInspection(session.userId, {
      camionId: body.camionId,
      inspeccionId: body.inspeccionProgramadaId,
      respuestas: body.detalles,
      notaFinal: body.nota,
      observacionesGenerales: body.estadoInspeccion?.meta?.lugar,
    });
    return NextResponse.json({ ok: true, inspeccionId, message: "Inspección guardada correctamente" }, { status: 201 });
  } catch (error) {
    if (error instanceof InspectionError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    console.error("Error guardando inspección:", error);
    return NextResponse.json({ ok: false, error: "Error al guardar inspección" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = requireInspector(req);
    if (!session || !session.userId) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const pool = await getPool();
    const inspectorId = session.userId;

    // Trae todas las inspecciones del día para el inspector
    const res = await pool
      .request()
      .input("inspectorId", inspectorId)
      .query(`
        SELECT i.id, i.camion_id, c.patente, i.estado, i.fecha_programada, i.fecha_inspeccion, i.resultado_general, i.nota_final
        FROM public.inspecciones i
        INNER JOIN public.camiones c ON c.id = i.camion_id
        WHERE i.inspector_id = @inspectorId
          AND CAST(i.fecha_programada AT TIME ZONE 'America/Santiago' AS DATE) = CAST(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago' AS DATE)
        ORDER BY i.fecha_programada DESC
      `);

    return NextResponse.json(
      {
        ok: true,
        inspecciones: res.recordset.map((x: any) => ({
          id: Number(x.id),
          camionId: Number(x.camion_id),
          patente: x.patente,
          estado: x.estado,
          resultado: x.resultado_general,
          nota: x.nota_final ?? null,
          fechaProgramada: x.fecha_programada,
          fechaInspeccion: x.fecha_inspeccion,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[API] GET /api/inspector/inspecciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
