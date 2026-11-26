import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/database";
import { getStaffSession } from "@/lib/shared/security/staff-auth";
import { requireCliente } from "@/lib/shared/security/cliente-auth";

const BUCKET = "petran-images";
const MAX_BYTES = 3 * 1024 * 1024;

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Almacenamiento de imágenes no configurado");
  return { url, headers: { apikey: key } };
}

export async function imageAccess(req: NextRequest, truckId: number) {
  const staff = getStaffSession(req);
  const cliente = requireCliente(req);
  if (!staff && !cliente) return null;
  const pool = await getPool();
  const result = await pool.request().input("id", truckId).input("inspector", staff?.userId ?? null).query(`
    SELECT p.empresa_id, EXISTS (SELECT 1 FROM inspecciones i WHERE i.camion_id=c.id AND i.inspector_id=@inspector) AS assigned
    FROM camiones c JOIN proveedores p ON p.id=c.proveedor_id WHERE c.id=@id
  `);
  const row = result.recordset[0];
  if (!row) return null;
  if (staff?.rol === "admin" || (staff?.rol === "inspector" && row.assigned) || Number(cliente?.empresaId) === Number(row.empresa_id)) return Number(row.empresa_id);
  return null;
}

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { mime: "image/png", ext: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", ext: "jpg" };
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8,12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

export async function uploadPhoto(req: NextRequest, saveTruckPhoto = false) {
  try {
    if (!getStaffSession(req) && !requireCliente(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    let truckId: number;
    let bytes: Buffer;
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await req.formData();
      truckId = Number(form.get("camionId"));
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Selecciona una imagen" }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ error: "La imagen debe pesar como máximo 3 MB" }, { status: 400 });
      bytes = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      truckId = Number(body.camionId);
      if (typeof body.file !== "string" || body.file.length > MAX_BYTES * 1.4) return NextResponse.json({ error: "Imagen inválida o demasiado grande" }, { status: 400 });
      bytes = Buffer.from(body.file.replace(/^data:image\/[^;]+;base64,/, ""), "base64");
    }
    if (!Number.isSafeInteger(truckId) || truckId <= 0) return NextResponse.json({ error: "Camión requerido" }, { status: 400 });
    const empresaId = await imageAccess(req, truckId);
    if (!empresaId) return NextResponse.json({ error: "No autorizado para este camión" }, { status: 403 });
    const type = imageType(bytes);
    if (!type || !bytes.length || bytes.length > MAX_BYTES) return NextResponse.json({ error: "Usa una imagen JPG, PNG o WebP de hasta 3 MB" }, { status: 400 });
    const path = `empresas/${empresaId}/camiones/${truckId}/${randomUUID()}.${type.ext}`;
    const config = storageConfig();
    const response = await fetch(`${config.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST", headers: { ...config.headers, "Content-Type": type.mime, "x-upsert": "false" }, body: new Uint8Array(bytes),
    });
    if (!response.ok) throw new Error(`Storage upload failed: ${response.status}`);
    // Stable, authenticated URL: files remain private in Supabase.
    const url = `/api/media/${path}`;
    if (saveTruckPhoto) await (await getPool()).request().input("id", truckId).input("url", url).query(`
      INSERT INTO camion_fotos (camion_id,url) VALUES (@id,@url)
      ON CONFLICT (camion_id) DO UPDATE SET url=EXCLUDED.url
    `);
    return NextResponse.json({ success: true, data: { url, publicId: path, format: type.ext, bytes: bytes.length } });
  } catch (error) {
    console.error("Image upload failed", error);
    return NextResponse.json({ error: "No se pudo subir la imagen. Intenta nuevamente." }, { status: 500 });
  }
}

export async function readPhoto(req: NextRequest, path: string[]) {
  if (path.length !== 5 || path[0] !== "empresas" || path[2] !== "camiones" || !/^\d+$/.test(path[1]) || !/^\d+$/.test(path[3]) || !/^[a-f0-9-]+\.(png|jpg|webp)$/.test(path[4])) return new NextResponse(null, { status: 404 });
  const empresa = await imageAccess(req, Number(path[3]));
  if (!empresa || empresa !== Number(path[1])) return new NextResponse(null, { status: 403 });
  const config = storageConfig();
  const response = await fetch(`${config.url}/storage/v1/object/authenticated/${BUCKET}/${path.join("/")}`, { headers: config.headers, cache: "no-store" });
  if (!response.ok) return new NextResponse(null, { status: 404 });
  return new NextResponse(response.body, { headers: { "Content-Type": response.headers.get("Content-Type") ?? "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
