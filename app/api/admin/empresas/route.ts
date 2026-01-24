// app/api/admin/empresas/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import { getPool, sql } from "@/lib/azure-sql";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = requireAdmin(req);
    if (!session) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });

    const pool = await getPool();

    const r = await pool.request().query(`
      SELECT
        id,
        nombre,
        rut,
        rubro,
        email_contacto,
        telefono_contacto,
        direccion,
        prioridad_frio,
        prioridad_carroceria,
        prioridad_estructura,
        prioridad_camion,
        prioridad_acople,
        created_at
      FROM dbo.empresas
      ORDER BY created_at DESC
    `);

    return NextResponse.json({ ok: true, empresas: r.recordset }, { status: 200 });
  } catch (err) {
    console.error("GET /api/admin/empresas error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
