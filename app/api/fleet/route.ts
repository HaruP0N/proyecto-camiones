import { NextRequest } from "next/server";
import * as fleet from "@/lib/fleet/handlers";
export const runtime = "nodejs";
export function GET(req: NextRequest) { return fleet.GET(req); }
export function POST(req: NextRequest) { return fleet.POST(req); }
export function PUT(req: NextRequest) { return fleet.PUT(req); }
