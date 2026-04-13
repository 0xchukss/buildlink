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
    const body = (await request.json()) as {
      rating?: number;
      comment?: string;
    };

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: "rating is required and must be between 1 and 5" },
        { status: 400 },
      );
    }

    if (body.comment && body.comment.length > 500) {
      return NextResponse.json(
        { error: "comment must be 500 characters or less" },
        { status: 400 },
      );
    }

    const job = await getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.creatorAddress.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the job creator can submit a review" },
        { status: 403 },
      );
    }

    if (job.status !== "paid") {
      return NextResponse.json(
        { error: "Review is available only after payout completion" },
        { status: 400 },
      );
    }

    if (!job.doerAddress && !job.submission?.doerAddress) {
      return NextResponse.json(
        { error: "No doer found for this job" },
        { status: 400 },
      );
    }

    const updated = await updateJob(job.id, {
      review: {
        rating: body.rating,
        comment: body.comment?.trim() || undefined,
        reviewedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit review" },
      { status: 500 },
    );
  }
}
