import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { prisma } from "@/lib/db";

type SocialsPayload = {
  twitter?: string;
  github?: string;
  website?: string;
  telegram?: string;
  discord?: string;
};

function emptyProfile(address: string) {
  return {
    address,
    displayName: "",
    bio: "",
    avatarUrl: "",
    socials: {},
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ address: string }> },
) {
  try {
    const params = await context.params;
    const address = getAddress(params.address).toLowerCase();

    const profile = await prisma.userProfile.findUnique({
      where: { address },
    });

    if (!profile) {
      return NextResponse.json({ profile: emptyProfile(address) });
    }

    let socials: SocialsPayload = {};
    try {
      socials = profile.socialsJson
        ? (JSON.parse(profile.socialsJson) as SocialsPayload)
        : {};
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
  } catch {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
}
