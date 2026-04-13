import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractForumMedia } from "@/lib/forum-media";

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

    if (!content && !mediaJson) {
      return NextResponse.json(
        { error: "Reply text or media is required" },
        { status: 400 },
      );
    }

    await prisma.forumReply.create({
      data: {
        id: randomUUID(),
        postId: post.id,
        authorAddress: session.address.toLowerCase(),
        body: content,
        mediaJson,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post reply" },
      { status: 500 },
    );
  }
}
