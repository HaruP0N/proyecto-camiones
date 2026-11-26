import { NextRequest, NextResponse } from "next/server";
import { requireInspector } from "@/lib/shared/security/staff-auth";
import { saveInspection, InspectionError } from "@/lib/inspection/save";

export const runtime = "nodejs";

// This existing endpoint's [id] is a truck ID, as sent by the inspector PWA.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = requireInspector(req);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    await saveInspection(session.userId, { ...body, camionId: Number(id) });
    return NextResponse.json({ success: true, message: "Enviado a revisión" });
  } catch (error) {
    if (error instanceof InspectionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Error API Completar:", error);
    return NextResponse.json({ error: "Error al guardar inspección" }, { status: 500 });
  }
}
