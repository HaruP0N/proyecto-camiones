import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import { getPool } from "@/lib/azure-sql";

export const runtime = "nodejs";

function parseId(req: NextRequest) {
  const last = req.nextUrl.pathname.split("/").filter(Boolean).pop() || "";
  const onlyDigits = last.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

    const id = parseId(req);
    if (!id) return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const nombre = (body as any).nombre !== undefined ? String((body as any).nombre).trim() : undefined;

    const email =
      (body as any).email !== undefined ? normalizeEmail(String((body as any).email)) : undefined;

    const activo = (body as any).activo !== undefined ? !!(body as any).activo : undefined;

    if (nombre === undefined && email === undefined && activo === undefined) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar." }, { status: 400 });
    }

    const pool = await getPool();

    const ok = await pool.request().input("id", id).query(`
      SELECT TOP 1 id
      FROM dbo.usuarios
      WHERE id=@id AND LOWER(LTRIM(RTRIM(rol)))='inspector'
    `);
    if (ok.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspector no encontrado." }, { status: 404 });
    }

    if (email !== undefined) {
      const dup = await pool
        .request()
        .input("email", email)
        .input("id", id)
        .query(`
          SELECT TOP 1 id
          FROM dbo.usuarios
          WHERE LOWER(LTRIM(RTRIM(email)))=@email AND id<>@id
        `);

      if (dup.recordset.length > 0) {
        return NextResponse.json(
          { ok: false, error: "Ya existe otro usuario con ese email." },
          { status: 409 }
        );
      }
    }

    const sets: string[] = [];
    const request = pool.request().input("id", id);

    if (nombre !== undefined) {
      sets.push("nombre=@nombre");
      request.input("nombre", nombre);
    }
    if (email !== undefined) {
      sets.push("email=@email");
      request.input("email", email);
    }
    if (activo !== undefined) {
      sets.push("activo=@activo");
      request.input("activo", activo ? 1 : 0);
    }

    await request.query(`
      UPDATE dbo.usuarios
      SET ${sets.join(", ")}
      WHERE id=@id
    `);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/admin/inspectores/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
