import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    { status: "ok", ts: new Date().toISOString() },
    { status: 200 },
  );
}
