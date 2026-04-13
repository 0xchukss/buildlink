import { NextResponse } from "next/server";
import { attachSessionCookie, verifyChallenge } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      nonce?: string;
      signature?: `0x${string}`;
    };

    if (!body.address || !body.nonce || !body.signature) {
      return NextResponse.json(
        { error: "address, nonce and signature are required" },
        { status: 400 },
      );
    }

    const session = await verifyChallenge({
      address: body.address,
      nonce: body.nonce,
      signature: body.signature,
    });

    const response = NextResponse.json({
      authenticated: true,
      address: session.address,
      expiresAt: session.expiresAt.toISOString(),
    });

    attachSessionCookie(response, { id: session.sessionId, expiresAt: session.expiresAt });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 401 },
    );
  }
}
