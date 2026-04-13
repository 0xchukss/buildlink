import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getJobById, removeUnattendedJob } from "@/lib/store";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const job = await getJobById(params.id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.creatorAddress.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the job creator can remove this job" },
        { status: 403 },
      );
    }

    const hasAnyDoerActivity =
      !!job.doerAddress ||
      !!job.submission?.doerAddress ||
      !!job.submission?.submittedAt;

    if (hasAnyDoerActivity) {
      return NextResponse.json(
        { error: "Cannot remove a job that already has doer activity" },
        { status: 409 },
      );
    }

    await removeUnattendedJob(job.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to remove job",
      },
      { status: 500 },
    );
  }
}
