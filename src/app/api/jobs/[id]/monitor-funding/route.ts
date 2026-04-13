import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { ARC_USDC_ADDRESS } from "@/lib/constants";
import { checkTransferViaCircleMonitor } from "@/lib/circle";
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
      txHash?: string;
      approveTxHash?: string;
    };

    if (!body.txHash) {
      return NextResponse.json({ error: "txHash is required" }, { status: 400 });
    }

    const job = await getJobById(params.id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.creatorAddress.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await updateJob(job.id, {
      status: "funding_pending",
      approveTxHash: body.approveTxHash,
      fundingTxHash: body.txHash,
    });

    const funded = await checkTransferViaCircleMonitor({
      txHash: body.txHash,
      toAddress: job.escrowAddress,
      tokenAddress: ARC_USDC_ADDRESS,
    });

    if (!funded) {
      return NextResponse.json(
        {
          funded: false,
          job: await getJobById(params.id),
          error: "Transfer event not yet indexed by Circle Monitor",
        },
        { status: 202 },
      );
    }

    const updated = await updateJob(job.id, {
      status: "funded",
    });

    return NextResponse.json({ funded: true, job: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Funding monitor check failed",
      },
      { status: 500 },
    );
  }
}
