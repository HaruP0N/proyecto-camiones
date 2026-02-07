import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { requireAdmin } from "@/lib/shared/security/staff-auth";
import { getPool } from "@/lib/azure-sql";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/inspecciones/[id]/review
 * Obtiene los detalles completos de una inspeccion realizada para revision del admin
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const inspeccionId = Number(id);
    if (!Number.isInteger(inspeccionId) || inspeccionId <= 0) {
      return NextResponse.json({ ok: false, error: "ID invalido" }, { status: 400 });
    }

    const pool = await getPool();

    // Obtener info general de la inspeccion
    const inspeccionRes = await pool
      .request()
      .input("id", sql.Int, inspeccionId)
      .query(`
        SELECT
          i.id,
          i.camion_id,
          c.patente,
          c.marca,
          c.modelo,
          e.nombre AS empresa_nombre,
          u.nombre AS inspector_nombre,
          i.estado,
          i.resultado_general,
          i.nota_final,
          i.observaciones_generales,
          CONVERT(varchar(16), i.fecha_inspeccion, 126) AS fecha_inspeccion,
          CONVERT(varchar(16), i.fecha_programada, 126) AS fecha_programada,
          i.revision_admin,
          i.comentario_admin
        FROM dbo.inspecciones i
        INNER JOIN dbo.camiones c ON c.id = i.camion_id
        INNER JOIN dbo.proveedores p ON p.id = c.proveedor_id
        INNER JOIN dbo.empresas e ON e.id = p.empresa_id
        LEFT JOIN dbo.usuarios u ON u.id = i.inspector_id
        WHERE i.id = @id
      `);

    if (inspeccionRes.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspeccion no encontrada" }, { status: 404 });
    }

    const inspeccion = inspeccionRes.recordset[0];

    // Obtener detalles de items inspeccionados
    const detallesRes = await pool
      .request()
      .input("inspeccion_id", sql.Int, inspeccionId)
      .query(`
        SELECT
          d.id,
          d.item_id,
          d.estado,
          d.descripcion_falla,
          d.motivo_no_aplica,
          d.categoria
        FROM dbo.detalle_inspeccion d
        WHERE d.inspeccion_id = @inspeccion_id
        ORDER BY d.item_id
      `);

    return NextResponse.json({
      ok: true,
      inspeccion: {
        id: Number(inspeccion.id),
        camionId: Number(inspeccion.camion_id),
        patente: inspeccion.patente,
        marca: inspeccion.marca,
        modelo: inspeccion.modelo,
        empresa: inspeccion.empresa_nombre,
        inspector: inspeccion.inspector_nombre,
        estado: inspeccion.estado,
        resultado: inspeccion.resultado_general,
        nota: inspeccion.nota_final,
        observaciones: inspeccion.observaciones_generales,
        fechaInspeccion: inspeccion.fecha_inspeccion,
        fechaProgramada: inspeccion.fecha_programada,
        revisionAdmin: inspeccion.revision_admin ?? null,
        comentarioAdmin: inspeccion.comentario_admin ?? null,
      },
      detalles: (detallesRes.recordset || []).map((d: any) => ({
        id: Number(d.id),
        itemId: d.item_id,
        estado: d.estado,
        descripcionFalla: d.descripcion_falla,
        motivoNoAplica: d.motivo_no_aplica,
        categoria: d.categoria,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/inspecciones/[id]/review error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/admin/inspecciones/[id]/review
 * Admin acepta, rechaza o solicita correccion de una inspeccion
 * Body: { action: "ACEPTAR" | "RECHAZAR" | "CORRECCION", comentario?: string, edits?: object }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = requireAdmin(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const inspeccionId = Number(id);
    if (!Number.isInteger(inspeccionId) || inspeccionId <= 0) {
      return NextResponse.json({ ok: false, error: "ID invalido" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Body invalido" }, { status: 400 });
    }

    const { action, comentario, edits } = body as {
      action: string;
      comentario?: string;
      edits?: { nota?: number; resultado?: string };
    };

    const validActions = ["ACEPTAR", "RECHAZAR", "CORRECCION"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { ok: false, error: "Accion invalida. Use: ACEPTAR, RECHAZAR o CORRECCION" },
        { status: 400 }
      );
    }

    const pool = await getPool();

    // Verificar que la inspeccion existe y esta REALIZADA
    const check = await pool
      .request()
      .input("id", sql.Int, inspeccionId)
      .query(`SELECT TOP 1 id, estado FROM dbo.inspecciones WHERE id = @id`);

    if (check.recordset.length === 0) {
      return NextResponse.json({ ok: false, error: "Inspeccion no encontrada" }, { status: 404 });
    }

    const comentarioTrim = comentario?.trim() || null;

    if (action === "ACEPTAR") {
      // Aplicar ediciones si las hay
      const notaEdit = edits?.nota;
      const resultadoEdit = edits?.resultado;

      const r = pool
        .request()
        .input("id", sql.Int, inspeccionId)
        .input("revision", sql.VarChar(50), "ACEPTADA")
        .input("comentario", sql.NVarChar(sql.MAX), comentarioTrim);

      let setClause = `revision_admin = @revision, comentario_admin = @comentario`;

      if (notaEdit != null && typeof notaEdit === "number") {
        r.input("nota", sql.Int, Math.min(100, Math.max(0, notaEdit)));
        setClause += `, nota_final = @nota`;
      }

      if (resultadoEdit && typeof resultadoEdit === "string") {
        r.input("resultado", sql.VarChar(50), resultadoEdit);
        setClause += `, resultado_general = @resultado`;
      }

      await r.query(`UPDATE dbo.inspecciones SET ${setClause} WHERE id = @id`);

      return NextResponse.json({ ok: true, message: "Inspeccion aceptada" });
    }

    if (action === "RECHAZAR") {
      if (!comentarioTrim) {
        return NextResponse.json(
          { ok: false, error: "Debe incluir un comentario al rechazar" },
          { status: 400 }
        );
      }

      await pool
        .request()
        .input("id", sql.Int, inspeccionId)
        .input("revision", sql.VarChar(50), "RECHAZADA")
        .input("comentario", sql.NVarChar(sql.MAX), comentarioTrim)
        .query(`
          UPDATE dbo.inspecciones
          SET revision_admin = @revision, comentario_admin = @comentario
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true, message: "Inspeccion rechazada" });
    }

    if (action === "CORRECCION") {
      if (!comentarioTrim) {
        return NextResponse.json(
          { ok: false, error: "Debe incluir comentarios de correccion" },
          { status: 400 }
        );
      }

      await pool
        .request()
        .input("id", sql.Int, inspeccionId)
        .input("revision", sql.VarChar(50), "CORRECCION_SOLICITADA")
        .input("comentario", sql.NVarChar(sql.MAX), comentarioTrim)
        .query(`
          UPDATE dbo.inspecciones
          SET revision_admin = @revision, comentario_admin = @comentario, estado = 'EN_CORRECCION'
          WHERE id = @id
        `);

      return NextResponse.json({ ok: true, message: "Correccion solicitada" });
    }

    return NextResponse.json({ ok: false, error: "Accion no implementada" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/inspecciones/[id]/review error:", err);
    return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

export default function InspeccionReviewPage() {
  const router = useRouter();

  return (
    <div>
      {/* Botón Volver al inicio */}
      <Button variant="outline" onClick={() => router.push("/admin")}>
        Volver al inicio
      </Button>
      {/* ...existing code for review details... */}
    </div>
  );
}