import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const messages = await prisma.jobMessage.findMany({
    where: { jobId: job.id },
    orderBy: { createdAt: "asc" },
  });

  const profiles = await prisma.userProfile.findMany({
    where: { address: { in: Array.from(new Set(messages.map((m) => m.authorAddress))) } },
    select: {
      address: true,
      displayName: true,
      avatarUrl: true,
    },
  });
  const profileByAddress = new Map(profiles.map((p) => [p.address, p]));

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      jobId: m.jobId,
      authorAddress: m.authorAddress,
      authorDisplayName: profileByAddress.get(m.authorAddress)?.displayName ?? undefined,
      authorAvatarUrl: profileByAddress.get(m.authorAddress)?.avatarUrl ?? undefined,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

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
    const body = (await request.json()) as { body?: string };
    const messageBody = body.body?.trim() ?? "";

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const actor = session.address.toLowerCase();
    const creator = job.creatorAddress.toLowerCase();
    const doer = (job.doerAddress ?? "").toLowerCase();

    // Only creator and doer can post; first non-creator poster can claim doer slot.
    if (actor !== creator && doer && actor !== doer) {
      return NextResponse.json(
        { error: "Only the job creator and assigned doer can chat" },
        { status: 403 },
      );
    }

    await prisma.$transaction(async (tx) => {
      if (!job.doerAddress && actor !== creator) {
        await tx.job.update({
          where: { id: job.id },
          data: { doerAddress: actor },
        });
      }

      await tx.jobMessage.create({
        data: {
          id: randomUUID(),
          jobId: job.id,
          authorAddress: actor,
          body: messageBody,
        },
      });
    });

    const messages = await prisma.jobMessage.findMany({
      where: { jobId: job.id },
      orderBy: { createdAt: "asc" },
    });

    const profiles = await prisma.userProfile.findMany({
      where: { address: { in: Array.from(new Set(messages.map((m) => m.authorAddress))) } },
      select: {
        address: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    const profileByAddress = new Map(profiles.map((p) => [p.address, p]));

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        jobId: m.jobId,
        authorAddress: m.authorAddress,
        authorDisplayName: profileByAddress.get(m.authorAddress)?.displayName ?? undefined,
        authorAvatarUrl: profileByAddress.get(m.authorAddress)?.avatarUrl ?? undefined,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to post message" },
      { status: 500 },
    );
  }
}
