import { NextRequest } from "next/server";
import { readPhoto } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) { return readPhoto(req, (await ctx.params).path); }
