import { NextResponse } from "next/server";
import { clearSessionCookie, revokeSession } from "@/lib/auth";

export async function POST(request: Request) {
  await revokeSession(request);

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
