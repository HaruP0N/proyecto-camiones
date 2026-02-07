import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/azure-sql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import { hashPin } from "@/lib/shared/utils/pin";

export const runtime = "nodejs";

function parseEmpresaIdFromPath(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // .../admin/empresas/{id}/reset-pin
  const raw = parts[parts.length - 2] || "";
  const onlyDigits = raw.replace(/[^\d]/g, "");
  const n = Number(onlyDigits);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function generate4DigitPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const empresaId = parseEmpresaIdFromPath(req);
    if (!empresaId) {
      return NextResponse.json({ ok: false, error: "ID inválido" }, { status: 400 });
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

    const pinPlano = generate4DigitPin();
    const pinHash = await hashPin(pinPlano);

    await pool
      .request()
      .input("id", empresaId)
      .input("pin_hash", pinHash)
      .query(`
        UPDATE dbo.empresas
        SET pin_hash=@pin_hash
        WHERE id=@id
      `);

    return NextResponse.json({ ok: true, pinPlano }, { status: 200 });
  } catch (err) {
    console.error("POST /api/admin/empresas/[id]/reset-pin error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
