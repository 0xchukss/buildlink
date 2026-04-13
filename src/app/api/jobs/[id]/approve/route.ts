import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getJobById, updateJob } from "@/lib/store";

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

    const job = await getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "submitted_for_review") {
      return NextResponse.json(
        { error: "Job is not awaiting creator review" },
        { status: 400 },
      );
    }

    if (job.creatorAddress.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the job creator can approve this submission" },
        { status: 403 },
      );
    }

    const updated = await updateJob(job.id, {
      status: "approved_for_claim",
      submission: {
        ...job.submission,
        approvedByCreatorAt: new Date().toISOString(),
        attachments: job.submission?.attachments ?? [],
        doerAddress: job.submission?.doerAddress ?? job.doerAddress ?? "",
        submittedAt: job.submission?.submittedAt ?? new Date().toISOString(),
      },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Approval failed",
      },
      { status: 500 },
    );
  }
}
