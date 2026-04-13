import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { listProofsForOwner } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  const params = await context.params;
  const session = await getSessionFromRequest(_request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!params.address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  if (params.address.toLowerCase() !== session.address.toLowerCase()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ proofs: await listProofsForOwner(params.address) });
}
