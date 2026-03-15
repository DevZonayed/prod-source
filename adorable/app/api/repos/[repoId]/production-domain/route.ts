import { NextResponse } from "next/server";

// Production domain configuration is not available in local mode
export async function POST() {
  return NextResponse.json(
    { error: "Production domain configuration is not available in local mode." },
    { status: 501 },
  );
}
