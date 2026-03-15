import { NextResponse } from "next/server";

// Deployment promotion is not available in local mode
export async function POST() {
  return NextResponse.json(
    { error: "Deployment promotion is not available in local mode." },
    { status: 501 },
  );
}
