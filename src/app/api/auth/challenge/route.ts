import { NextResponse } from "next/server";
import { createChallenge } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { address?: string };
    if (!body.address) {
      return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const origin = request.headers.get("origin") ?? undefined;
    const challenge = await createChallenge(body.address, origin);
    return NextResponse.json(challenge);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Challenge failed" },
      { status: 500 },
    );
  }
}
