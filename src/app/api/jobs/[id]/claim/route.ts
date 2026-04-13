import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { addProof, getJobById, updateJob } from "@/lib/store";
import { isProofNftEnabled, mintProofNft, payoutUsdc } from "@/lib/circle";

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

    if (job.status !== "approved_for_claim") {
      return NextResponse.json(
        { error: "Creator approval is required before claiming" },
        { status: 400 },
      );
    }

    const submissionDoer = job.submission?.doerAddress ?? job.doerAddress;
    if (!submissionDoer || submissionDoer.toLowerCase() !== session.address.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the approved doer can claim this reward" },
        { status: 403 },
      );
    }

    const tokenUri =
      job.submission?.attachments[0]?.url ??
      job.submission?.note ??
      "ipfs://builderlink-proof";

    let mint: Awaited<ReturnType<typeof mintProofNft>> | null = null;
    let mintTxId: string | undefined;

    if (isProofNftEnabled()) {
      mint = await mintProofNft({
        doerAddress: session.address,
        tokenUri,
      });

      mintTxId = mint.data?.id ?? "unknown-mint-tx";

      await updateJob(job.id, {
        status: "proof_minted",
        proofMintTxId: mintTxId,
      });

      await addProof({
        jobId: job.id,
        ownerAddress: session.address,
        mintTxId,
        tokenUri,
      });
    }

    const payout = await payoutUsdc({
      doerAddress: session.address,
      rewardAmount: job.rewardUsdc,
    });

    const payoutTxId = payout.data?.id ?? "unknown-payout-tx";

    await updateJob(job.id, {
      status: "paid",
      payoutTxId,
    });

    return NextResponse.json({
      job: await getJobById(job.id),
      mint,
      payout,
      proof: mintTxId ? { mintTxId, tokenUri } : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Claim failed",
      },
      { status: 500 },
    );
  }
}
