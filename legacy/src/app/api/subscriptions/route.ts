import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Subscription billing is not yet available." },
    { status: 503 }
  );
}
