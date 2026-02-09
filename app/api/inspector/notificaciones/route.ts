import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
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
    request.input("limit", Number.isFinite(limit) ? limit : 20);

    const where = soloNoLeidas ? "AND leida = 0" : "";

    const q = `
      SELECT TOP (@limit)
        id, usuario_id, inspeccion_id, tipo, titulo, mensaje, leida,
        CONVERT(varchar(30), created_at, 126) AS created_at
      FROM dbo.notificaciones
      WHERE usuario_id = @userId
      ${where}
      ORDER BY created_at DESC
    `;

    const res = await request.query(q);
    const countRes = await pool
      .request()
      .input("userId", session.userId)
      .query(`SELECT COUNT(*) AS unread FROM dbo.notificaciones WHERE usuario_id = @userId AND leida = 0`);

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
      await request.query(`UPDATE dbo.notificaciones SET leida = 1 WHERE usuario_id = @userId`);
    } else if (ids.length > 0) {
      request.input("ids", ids);
      await request.query(`UPDATE dbo.notificaciones SET leida = 1 WHERE usuario_id = @userId AND id IN (SELECT value FROM OPENJSON(@ids))`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/inspector/notificaciones error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
