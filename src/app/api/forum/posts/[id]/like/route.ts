import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const post = await prisma.forumPost.findUnique({ where: { id: params.id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const actor = session.address.toLowerCase();
    const existing = await prisma.forumLike.findUnique({
      where: { postId_authorAddress: { postId: post.id, authorAddress: actor } },
    });

    if (existing) {
      await prisma.forumLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }

    await prisma.forumLike.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        authorAddress: actor,
      },
    });

    return NextResponse.json({ liked: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle like" },
      { status: 500 },
    );
  }
}
