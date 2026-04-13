import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSessionFromRequest } from "@/lib/auth";
import { putAttachment } from "@/lib/storage";
import {
  getJobById,
  replaceJobAttachments,
  updateJob,
} from "@/lib/store";
import type { JobAttachment } from "@/lib/types";
import { validateAndPrepareAttachments } from "@/lib/upload-validation";

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
    const formData = await request.formData();
    const doerAddress = session.address.toLowerCase();
    const note = String(formData.get("note") ?? "").trim();
    const files = formData
      .getAll("attachments")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Attach at least one file before submitting for review" },
        { status: 400 },
      );
    }

    const job = await getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "funded") {
      return NextResponse.json(
        { error: "Job must be funded before completion" },
        { status: 400 },
      );
    }

    if (job.creatorAddress.toLowerCase() === doerAddress) {
      return NextResponse.json(
        { error: "Job creator cannot submit as doer" },
        { status: 403 },
      );
    }

    const validation = await validateAndPrepareAttachments(files);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const savedAttachments: Array<JobAttachment & { storageKey: string }> = [];

    for (const upload of validation.uploads) {
      const attachmentId = randomUUID();
      const stored = await putAttachment({
        bytes: upload.bytes,
        contentType: upload.contentType,
        fileName: upload.safeName,
        jobId: job.id,
      });

      savedAttachments.push({
        id: attachmentId,
        name: upload.safeName,
        contentType: upload.contentType,
        size: upload.file.size,
        url: `/api/attachments/${attachmentId}/download`,
        attachmentType: "proof" as const,
        storageKey: stored.storageKey,
        scanStatus: "clean",
      });
    }

    await replaceJobAttachments(
      job.id,
      savedAttachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        storageKey: attachment.storageKey,
      })),
    );

    await updateJob(job.id, {
      status: "submitted_for_review",
      doerAddress,
      submission: {
        doerAddress,
        note: note || undefined,
        attachments: savedAttachments,
        submittedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ job: await getJobById(job.id) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Submission failed",
      },
      { status: 500 },
    );
  }
}
