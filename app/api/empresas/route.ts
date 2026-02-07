import { type NextRequest, NextResponse } from "next/server"
import { getPool } from "@/lib/azure-sql"
import { hashPin, isValidPin } from "@/lib/shared/utils/pin"

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
      pin, // ✅ nuevo
    } = body

    if (!nombre || !rut) {
      return NextResponse.json({ error: "Nombre y RUT son obligatorios" }, { status: 400 })
    }

    // ✅ PIN requerido para clientes nuevos
    const pinStr = String(pin ?? "").trim()
    if (!isValidPin(pinStr)) {
      return NextResponse.json({ error: "PIN inválido. Debe ser de 4 dígitos." }, { status: 400 })
    }

    const pin_hash = await hashPin(pinStr)

    const pool = await getPool()

    const result = await pool
      .request()
      .input("nombre", nombre)
      .input("rut", rut)
      .input("rubro", rubro || null)
      .input("productos_transportados", productos_transportados || null)
      .input("telefono_contacto", telefono_contacto || null)
      .input("email_contacto", email_contacto || null)
      .input("direccion", direccion || null)
      .input("prioridad_frio", prioridad_frio ? 1 : 0)
      .input("prioridad_carroceria", prioridad_carroceria ? 1 : 0)
      .input("prioridad_estructura", prioridad_estructura ? 1 : 0)
      .input("prioridad_camion", prioridad_camion ? 1 : 0)
      .input("prioridad_acople", prioridad_acople ? 1 : 0)
      .input("pin_hash", pin_hash)
      .query(`
        INSERT INTO empresas (
          nombre, rut, rubro, productos_transportados, 
          telefono_contacto, email_contacto, direccion,
          prioridad_frio, prioridad_carroceria, prioridad_estructura,
          prioridad_camion, prioridad_acople,
          pin_hash
        )
        OUTPUT INSERTED.id
        VALUES (
          @nombre, @rut, @rubro, @productos_transportados,
          @telefono_contacto, @email_contacto, @direccion,
          @prioridad_frio, @prioridad_carroceria, @prioridad_estructura,
          @prioridad_camion, @prioridad_acople,
          @pin_hash
        )
      `)

    return NextResponse.json({
      success: true,
      id: result.recordset[0].id,
      message: "Empresa registrada exitosamente",
    })
  } catch (error: any) {
    console.error("[empresas][POST] Error:", error)

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

    if (rut) {
      const result = await pool
        .request()
        .input("rut", rut)
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

    const result = await pool.request().query(`
      SELECT id, nombre, rut, rubro, productos_transportados, telefono_contacto, email_contacto, direccion,
             prioridad_frio, prioridad_carroceria, prioridad_estructura, prioridad_camion, prioridad_acople, created_at
      FROM empresas
      ORDER BY created_at DESC
    `)

    return NextResponse.json({
      success: true,
      empresas: result.recordset,
    })
  } catch (error) {
    console.error("[empresas][GET] Error:", error)
    return NextResponse.json({ error: "Error al obtener empresas" }, { status: 500 })
  }
}
