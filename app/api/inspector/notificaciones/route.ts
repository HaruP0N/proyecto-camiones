import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { requireInspector } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = requireInspector(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 20);
    const soloNoLeidas = searchParams.get("unread") === "1";

    const pool = await getPool();
    const request = pool.request();
    request.input("userId", session.userId);
    request.input("limit", Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 20);

    const where = soloNoLeidas ? "AND leida = FALSE" : "";

    const q = `
      SELECT id, usuario_id, inspeccion_id, tipo, titulo, mensaje, leida,
        to_char(created_at AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
      FROM public.notificaciones
      WHERE usuario_id = @userId
      ${where}
      ORDER BY created_at DESC
     LIMIT @limit`;

    const res = await request.query(q);
    const countRes = await pool
      .request()
      .input("userId", session.userId)
      .query(`SELECT COUNT(*)::integer AS unread FROM public.notificaciones WHERE usuario_id = @userId AND leida = FALSE`);

    return NextResponse.json({ ok: true, data: res.recordset ?? [], unread: countRes.recordset?.[0]?.unread ?? 0 });
  } catch (err) {
    console.error("GET /api/inspector/notificaciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireInspector(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => Number(x)).filter((x: number) => Number.isInteger(x)) : [];
    const markAll = body?.all === true;

    const pool = await getPool();
    const request = pool.request();
    request.input("userId", session.userId);

    if (markAll) {
      await request.query(`UPDATE public.notificaciones SET leida = TRUE WHERE usuario_id = @userId`);
    } else if (ids.length > 0) {
      request.input("ids", ids);
      await request.query(`UPDATE public.notificaciones SET leida = TRUE WHERE usuario_id = @userId AND id = ANY(CAST(@ids AS integer[]))`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/inspector/notificaciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
