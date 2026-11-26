import { NextRequest, NextResponse } from "next/server";
import { requireInspector } from "@/lib/shared/security/staff-auth";
import { uploadPhoto } from "@/lib/storage";
export const runtime = "nodejs";
export function POST(req: NextRequest) {
  if (!requireInspector(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return uploadPhoto(req);
}
