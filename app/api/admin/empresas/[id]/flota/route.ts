import { NextRequest } from "next/server";
import * as fleet from "@/lib/fleet/handlers";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: NextRequest, ctx: Ctx) { return fleet.GET(req, Number((await ctx.params).id)); }
export async function POST(req: NextRequest, ctx: Ctx) { return fleet.POST(req, Number((await ctx.params).id)); }
export async function PUT(req: NextRequest, ctx: Ctx) { return fleet.PUT(req, Number((await ctx.params).id)); }
