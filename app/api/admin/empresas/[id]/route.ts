import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";

export const runtime = "nodejs";

function parseId(req: NextRequest) {
  const last = req.nextUrl.pathname.split("/").filter(Boolean).pop() || "";
  const onlyDigits = last.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export async function PATCH(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const empresaId = parseId(req);
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
    }

    const nombre = (body as any).nombre !== undefined ? String((body as any).nombre).trim() : undefined;
    const rut = (body as any).rut !== undefined ? String((body as any).rut).trim() : undefined;
    const rubro = (body as any).rubro !== undefined ? String((body as any).rubro).trim() : undefined;
    const email_contacto =
      (body as any).email_contacto !== undefined ? String((body as any).email_contacto).trim() : undefined;
    const telefono_contacto =
      (body as any).telefono_contacto !== undefined ? String((body as any).telefono_contacto).trim() : undefined;

    if (
      nombre === undefined &&
      rut === undefined &&
      rubro === undefined &&
      email_contacto === undefined &&
      telefono_contacto === undefined
    ) {
      return NextResponse.json({ ok: false, error: "No hay campos para actualizar." }, { status: 400 });
    }

    const pool = await getPool();

    const exists = await pool.request().input("id", empresaId).query(`
      SELECT TOP 1 id
      FROM dbo.empresas
      WHERE id=@id
    `);

    if (exists.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 });
    }

    const sets: string[] = [];
    const request = pool.request().input("id", empresaId);

    if (nombre !== undefined) {
      sets.push("nombre=@nombre");
      request.input("nombre", nombre);
    }
    if (rut !== undefined) {
      sets.push("rut=@rut");
      request.input("rut", rut);
    }
    if (rubro !== undefined) {
      sets.push("rubro=@rubro");
      request.input("rubro", rubro);
    }
    if (email_contacto !== undefined) {
      sets.push("email_contacto=@email_contacto");
      request.input("email_contacto", email_contacto);
    }
    if (telefono_contacto !== undefined) {
      sets.push("telefono_contacto=@telefono_contacto");
      request.input("telefono_contacto", telefono_contacto);
    }

    await request.query(`
      UPDATE dbo.empresas
      SET ${sets.join(", ")}
      WHERE id=@id
    `);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/admin/empresas/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
