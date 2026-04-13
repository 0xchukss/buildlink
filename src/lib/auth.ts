import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAddress, verifyMessage } from "viem";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "builderlink_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CHALLENGE_TTL_MS = 1000 * 60 * 10;

function parseCookies(header: string | null) {
  if (!header) {
    return {} as Record<string, string>;
  }

  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }
    result[name] = decodeURIComponent(rest.join("=") || "");
  }
  return result;
}

export function buildSignInMessage(address: string, nonce: string, origin?: string) {
  const issuedAt = new Date().toISOString();
  const uri = origin || "http://localhost:3000";

  return [
    "BuilderLink Arc Sign-In",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `URI: ${uri}`,
    `Issued At: ${issuedAt}`,
    "Statement: Sign to authenticate and perform protected actions.",
  ].join("\n");
}

export async function createChallenge(addressInput: string, origin?: string) {
  const address = getAddress(addressInput);
  const nonce = randomUUID().replaceAll("-", "");
  const message = buildSignInMessage(address, nonce, origin);

  await prisma.authChallenge.create({
    data: {
      id: randomUUID(),
      nonce,
      address: address.toLowerCase(),
      message,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });

  return { nonce, message, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString() };
}

export async function verifyChallenge(input: {
  address: string;
  nonce: string;
  signature: `0x${string}`;
}) {
  const checksumAddress = getAddress(input.address);
  const normalizedAddress = checksumAddress.toLowerCase();

  const challenge = await prisma.authChallenge.findFirst({
    where: {
      nonce: input.nonce,
      address: normalizedAddress,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    throw new Error("Challenge not found or expired");
  }

  const valid = await verifyMessage({
    address: checksumAddress,
    message: challenge.message,
    signature: input.signature,
  });

  if (!valid) {
    throw new Error("Invalid wallet signature");
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.$transaction([
    prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    }),
    prisma.authSession.create({
      data: {
        id: sessionId,
        address: normalizedAddress,
        expiresAt,
      },
    }),
  ]);

  return { sessionId, address: normalizedAddress, expiresAt };
}

export async function getSessionFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return null;
  }

  const session = await prisma.authSession.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    address: session.address,
    expiresAt: session.expiresAt,
  };
}

export function attachSessionCookie(response: NextResponse, session: { id: string; expiresAt: Date }) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: session.id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function revokeSession(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return;
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
}
