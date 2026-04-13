import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionFromRequest } from "@/lib/auth";
import { putAttachment } from "@/lib/storage";
import { validateAndPrepareAttachments } from "@/lib/upload-validation";
import { addBriefAttachments, createJob, listJobs } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ jobs: await listJobs() });
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const escrowAddress = process.env.ESCROW_WALLET_ADDRESS;
    if (!escrowAddress) {
      return NextResponse.json(
        { error: "Missing ESCROW_WALLET_ADDRESS in environment" },
        { status: 500 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let title = "";
    let description = "";
    let rewardUsdc = "";
    let briefUrls: string[] = [];
    let briefFiles: Array<{ bytes: Uint8Array; contentType: string; fileName: string }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      title = (formData.get("title") as string | null)?.trim() ?? "";
      description = (formData.get("description") as string | null)?.trim() ?? "";
      rewardUsdc = (formData.get("rewardUsdc") as string | null)?.trim() ?? "";
      const rawUrls = (formData.get("briefUrls") as string | null) ?? "";
      briefUrls = rawUrls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));

      const files = formData.getAll("briefFiles") as File[];
      if (files.length > 0) {
        const validated = await validateAndPrepareAttachments(files);
        if (!validated.ok) {
          return NextResponse.json({ error: validated.error }, { status: 400 });
        }
        briefFiles = validated.uploads.map((v) => ({
          bytes: v.bytes,
          contentType: v.contentType,
          fileName: v.safeName,
        }));
      }
    } else {
      const body = (await request.json()) as {
        title?: string;
        description?: string;
        rewardUsdc?: string;
        briefUrls?: string[];
      };
      title = body.title?.trim() ?? "";
      description = body.description?.trim() ?? "";
      rewardUsdc = body.rewardUsdc?.trim() ?? "";
      briefUrls = body.briefUrls ?? [];
    }

    if (!title || !rewardUsdc) {
      return NextResponse.json(
        { error: "title and rewardUsdc are required" },
        { status: 400 },
      );
    }

    const job = await createJob({
      title,
      description: description || undefined,
      briefUrls,
      rewardUsdc,
      creatorAddress: session.address,
      escrowAddress,
    });

    // Upload brief files if any
    if (briefFiles.length > 0) {
      const stored = await Promise.all(
        briefFiles.map(async (file) => {
          const id = randomUUID();
          const result = await putAttachment({
            bytes: file.bytes,
            contentType: file.contentType,
            fileName: file.fileName,
            jobId: job.id,
          });
          return { id, name: file.fileName, contentType: file.contentType, size: file.bytes.length, storageKey: result.storageKey };
        }),
      );
      await addBriefAttachments(job.id, stored);
    }

    const finalJob = briefFiles.length > 0
      ? (await import("@/lib/store").then((m) => m.getJobById(job.id))) ?? job
      : job;

    return NextResponse.json({ job: finalJob }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create job",
      },
      { status: 500 },
    );
  }
}
