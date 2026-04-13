import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SocialsPayload = {
  twitter?: string;
  github?: string;
  website?: string;
  telegram?: string;
  discord?: string;
};

function sanitizeSocials(input: SocialsPayload | undefined) {
  if (!input) {
    return {};
  }

  const clean: SocialsPayload = {};
  for (const [key, value] of Object.entries(input)) {
    const v = (value ?? "").trim();
    if (v) {
      clean[key as keyof SocialsPayload] = v;
    }
  }
  return clean;
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { address: session.address.toLowerCase() },
  });

  if (!profile) {
    return NextResponse.json({
      profile: {
        address: session.address.toLowerCase(),
        displayName: "",
        bio: "",
        avatarUrl: "",
        socials: {},
      },
    });
  }

  let socials: SocialsPayload = {};
  try {
    socials = profile.socialsJson ? (JSON.parse(profile.socialsJson) as SocialsPayload) : {};
  } catch {
    socials = {};
  }

  return NextResponse.json({
    profile: {
      address: profile.address,
      displayName: profile.displayName ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
      socials,
    },
  });
}

export async function PUT(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      socials?: SocialsPayload;
    };

    const address = session.address.toLowerCase();
    const displayName = body.displayName?.trim() ?? "";
    const bio = body.bio?.trim() ?? "";
    const avatarUrl = body.avatarUrl?.trim() ?? "";
    const socials = sanitizeSocials(body.socials);

    const existing = await prisma.userProfile.findUnique({ where: { address } });

    if (!existing) {
      await prisma.userProfile.create({
        data: {
          id: randomUUID(),
          address,
          displayName: displayName || null,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
          socialsJson: JSON.stringify(socials),
        },
      });
    } else {
      await prisma.userProfile.update({
        where: { address },
        data: {
          displayName: displayName || null,
          bio: bio || null,
          avatarUrl: avatarUrl || null,
          socialsJson: JSON.stringify(socials),
        },
      });
    }

    return GET(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 },
    );
  }
}
