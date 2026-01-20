import { type NextRequest, NextResponse } from "next/server"
import { getPool, sql } from "@/lib/azure-sql"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      nombre,
      rut,
      rubro,
      productos_transportados,
      telefono_contacto,
      email_contacto,
      direccion,
      prioridad_frio,
      prioridad_carroceria,
      prioridad_estructura,
      prioridad_camion,
      prioridad_acople,
    } = body

    // Validación básica
    if (!nombre || !rut) {
      return NextResponse.json({ error: "Nombre y RUT son obligatorios" }, { status: 400 })
    }

    const pool = await getPool()

    const result = await pool
      .request()
      .input("nombre", sql.VarChar(150), nombre)
      .input("rut", sql.VarChar(20), rut)
      .input("rubro", sql.VarChar(100), rubro || null)
      .input("productos_transportados", sql.VarChar(sql.MAX), productos_transportados || null)
      .input("telefono_contacto", sql.VarChar(20), telefono_contacto || null)
      .input("email_contacto", sql.VarChar(150), email_contacto || null)
      .input("direccion", sql.VarChar(300), direccion || null)
      .input("prioridad_frio", sql.Bit, prioridad_frio ? 1 : 0)
      .input("prioridad_carroceria", sql.Bit, prioridad_carroceria ? 1 : 0)
      .input("prioridad_estructura", sql.Bit, prioridad_estructura ? 1 : 0)
      .input("prioridad_camion", sql.Bit, prioridad_camion ? 1 : 0)
      .input("prioridad_acople", sql.Bit, prioridad_acople ? 1 : 0)
      .query(`
        INSERT INTO empresas (
          nombre, rut, rubro, productos_transportados, 
          telefono_contacto, email_contacto, direccion,
          prioridad_frio, prioridad_carroceria, prioridad_estructura,
          prioridad_camion, prioridad_acople
        )
        OUTPUT INSERTED.id
        VALUES (
          @nombre, @rut, @rubro, @productos_transportados,
          @telefono_contacto, @email_contacto, @direccion,
          @prioridad_frio, @prioridad_carroceria, @prioridad_estructura,
          @prioridad_camion, @prioridad_acople
        )
      `)

    return NextResponse.json({
      success: true,
      id: result.recordset[0].id,
      message: "Empresa registrada exitosamente",
    })
  } catch (error: any) {
    console.error("[empresas][POST] Error al registrar empresa:", error)

    // Error de RUT duplicado
    if (error?.number === 2627) {
      return NextResponse.json({ error: "El RUT ya está registrado" }, { status: 400 })
    }

    return NextResponse.json({ error: "Error al registrar empresa en la base de datos" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rut = searchParams.get("rut")

    const pool = await getPool()

    // ✅ Buscar por RUT (para redirigir a flota cuando ya exista)
    if (rut) {
      const result = await pool
        .request()
        .input("rut", sql.VarChar(20), rut)
        .query(`
          SELECT TOP 1 id, nombre, rut
          FROM empresas
          WHERE rut = @rut
          ORDER BY created_at DESC
        `)

      return NextResponse.json({
        success: true,
        empresa: result.recordset?.[0] ?? null,
      })
    }

    // ✅ Listado general
    const result = await pool.request().query(`
      SELECT * FROM empresas
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      empresas: result.recordset,
    })
  } catch (error) {
    console.error("[empresas][GET] Error al obtener empresas:", error)
    return NextResponse.json({ error: "Error al obtener empresas" }, { status: 500 })
  }
}