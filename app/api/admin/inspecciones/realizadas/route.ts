import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

function isValidDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const url = new URL(req.url);
    const from = (url.searchParams.get("from") || "").trim();
    const to = (url.searchParams.get("to") || "").trim();
    const patente = (url.searchParams.get("patente") || "").trim();
    const empresa = (url.searchParams.get("empresa") || "").trim();

    if (from && !isValidDate(from)) {
      return NextResponse.json({ ok: false, error: "from inválido (YYYY-MM-DD)" }, { status: 400 });
    }
    if (to && !isValidDate(to)) {
      return NextResponse.json({ ok: false, error: "to inválido (YYYY-MM-DD)" }, { status: 400 });
    }

    const pool = await getPool();

    // Fecha para filtrar: preferimos fecha_realizada (datetime2), si no existe usamos fecha_programada,
    // y como última opción fecha_inspeccion (DATE) convertida.
    // Rango: >= from y < (to + 1 día) para incluir todo el día "to".
    const q = `
      SELECT i.id,
        c.patente,
        e.nombre AS "empresaNombre",
        to_char(COALESCE(i.fecha_realizada, i.fecha_inspeccion, i.fecha_programada) AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI') AS "fechaInspeccion",
        u.nombre AS "inspectorNombre",
        i.resultado_general AS resultado
      FROM public.inspecciones i
      INNER JOIN public.camiones c ON c.id = i.camion_id
      INNER JOIN public.proveedores p ON p.id = c.proveedor_id
      INNER JOIN public.empresas e ON e.id = p.empresa_id
      LEFT JOIN public.usuarios u ON u.id = i.inspector_id
      WHERE i.estado = 'REALIZADA'
        ${from ? "AND COALESCE(i.fecha_realizada, i.fecha_inspeccion, i.fecha_programada) >= (CAST(@from AS timestamp) AT TIME ZONE 'America/Santiago')" : ""}
        ${to ? "AND COALESCE(i.fecha_realizada, i.fecha_inspeccion, i.fecha_programada) < ((CAST(@to AS date) + INTERVAL '1 day') AT TIME ZONE 'America/Santiago')" : ""}
        ${patente ? "AND UPPER(LTRIM(RTRIM(c.patente))) LIKE '%' || UPPER(@patente) || '%'" : ""}
        ${
          empresa
            ? "AND (UPPER(LTRIM(RTRIM(e.nombre))) LIKE '%' || UPPER(@empresa) || '%' OR UPPER(LTRIM(RTRIM(e.rut))) LIKE '%' || UPPER(@empresa) || '%')"
            : ""
        }
      ORDER BY COALESCE(i.fecha_realizada, i.fecha_inspeccion, i.fecha_programada) DESC LIMIT 500`;

    const r = pool.request();
    if (from) r.input("from", from);
    if (to) r.input("to", to);
    if (patente) r.input("patente", patente);
    if (empresa) r.input("empresa", empresa);

    const rs = await r.query(q);

    const rows = (rs.recordset || []).map((x: any) => ({
      id: Number(x.id),
      patente: x.patente ?? null,
      empresaNombre: x.empresaNombre ?? null,
      fechaInspeccion: x.fechaInspeccion ? String(x.fechaInspeccion).replace(" ", "T") : null,
      inspectorNombre: x.inspectorNombre ?? null,
      resultado: x.resultado ?? null,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    console.error("GET /api/admin/inspecciones/realizadas error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
