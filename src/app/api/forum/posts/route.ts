import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractForumMedia, parseForumMedia } from "@/lib/forum-media";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  const viewer = session?.address.toLowerCase();

  const posts = await prisma.forumPost.findMany({
    include: {
      replies: { orderBy: { createdAt: "asc" } },
      likes: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const addresses = new Set<string>();
  for (const post of posts) {
    addresses.add(post.authorAddress);
    for (const reply of post.replies) {
      addresses.add(reply.authorAddress);
    }
  }

  const profiles = addresses.size
    ? await prisma.userProfile.findMany({
        where: { address: { in: Array.from(addresses) } },
        select: {
          address: true,
          displayName: true,
          avatarUrl: true,
        },
      })
    : [];

  const profileByAddress = new Map(
    profiles.map((profile) => [profile.address, profile]),
  );

  return NextResponse.json({
    posts: posts.map((post) => ({
      id: post.id,
      authorAddress: post.authorAddress,
      authorDisplayName:
        profileByAddress.get(post.authorAddress)?.displayName ?? undefined,
      authorAvatarUrl:
        profileByAddress.get(post.authorAddress)?.avatarUrl ?? undefined,
      title: post.title,
      body: post.body,
      media: parseForumMedia(post.mediaJson),
      likeCount: post.likes.length,
      viewerLiked: !!viewer && post.likes.some((l) => l.authorAddress === viewer),
      createdAt: post.createdAt.toISOString(),
      replies: post.replies.map((reply) => ({
        id: reply.id,
        postId: reply.postId,
        authorAddress: reply.authorAddress,
        authorDisplayName:
          profileByAddress.get(reply.authorAddress)?.displayName ?? undefined,
        authorAvatarUrl:
          profileByAddress.get(reply.authorAddress)?.avatarUrl ?? undefined,
        body: reply.body,
        media: parseForumMedia(reply.mediaJson),
        createdAt: reply.createdAt.toISOString(),
      })),
    })),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    let content = "";
    let mediaJson: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = String(formData.get("body") ?? "").trim();
      mediaJson = JSON.stringify(await extractForumMedia(formData, "media"));
    } else {
      const body = (await request.json()) as { body?: string };
      content = body.body?.trim() ?? "";
    }

    if (!content) {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 },
      );
    }

    const generatedTitle = content.slice(0, 80);

    await prisma.forumPost.create({
      data: {
        id: randomUUID(),
        authorAddress: session.address.toLowerCase(),
        title: generatedTitle || "Post",
        body: content,
        mediaJson,
      },
    });

    return GET(request);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create post" },
      { status: 500 },
    );
  }
}
