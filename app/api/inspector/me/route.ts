import { NextRequest, NextResponse } from "next/server";
import { verifyTokenFromRequest, normalizeRole } from "@/lib/shared/security/staff-auth";
import { getPool } from "@/lib/azure-sql";

/**
 * GET /api/inspector/me
 * Obtiene los datos del inspector autenticado
 */
export async function GET(req: NextRequest) {
  try {
    const tokenData = verifyTokenFromRequest(req);
    if (!tokenData) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const role = normalizeRole(tokenData.rol);
    if (role !== "inspector") {
      return NextResponse.json(
        { error: "Solo inspectores" },
        { status: 403 }
      );
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("usuario_id", tokenData.userId)
      .query(`
        SELECT 
          id,
          email,
          nombre = email,
          rol,
          activo
        FROM usuarios
        WHERE id = @usuario_id AND rol = 'inspector' AND activo = 1
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { error: "Inspector no encontrado" },
        { status: 404 }
      );
    }

    const inspector = result.recordset[0];

    return NextResponse.json({
      success: true,
      data: {
        id: inspector.id,
        email: inspector.email,
        role: inspector.rol,
      },
    });
  } catch (error) {
    console.error("Error fetching inspector:", error);
    return NextResponse.json(
      { error: "Error al obtener datos" },
      { status: 500 }
    );
  }
}
