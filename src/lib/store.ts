import { CIRCLE_ERC721_TEMPLATE_ID } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Job, JobAttachment, ProofNft } from "@/lib/types";

type JobWithAttachments = Awaited<ReturnType<typeof prisma.job.findFirst>> & {
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
    attachmentType: string;
    scanStatus: "QUEUED" | "CLEAN" | "INFECTED" | "ERROR";
    scanDetails: string | null;
    signedUrl: string | null;
    signedUrlExpiresAt: Date | null;
  }>;
};

function toAttachment(attachment: NonNullable<JobWithAttachments["attachments"]>[number]): JobAttachment {
  return {
    id: attachment.id,
    name: attachment.name,
    contentType: attachment.contentType,
    size: attachment.size,
    url: attachment.signedUrl ?? `/api/attachments/${attachment.id}/download`,
    attachmentType: (attachment.attachmentType === "brief" ? "brief" : "proof") as JobAttachment["attachmentType"],
    scanStatus: attachment.scanStatus.toLowerCase() as JobAttachment["scanStatus"],
    scanDetails: attachment.scanDetails ?? undefined,
  };
}

function mapJob(row: JobWithAttachments | null | undefined): Job | undefined {
  if (!row) {
    return undefined;
  }

  const allAttachments = (row.attachments ?? []).map(toAttachment);
  const briefAttachments = allAttachments.filter((a) => a.attachmentType === "brief");
  const proofAttachments = allAttachments.filter((a) => a.attachmentType === "proof");

  let briefUrls: string[] = [];
  try {
    briefUrls = row.briefUrls ? (JSON.parse(row.briefUrls) as string[]) : [];
  } catch {
    briefUrls = [];
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    briefUrls,
    briefAttachments,
    rewardUsdc: row.rewardUsdc,
    creatorAddress: row.creatorAddress,
    escrowAddress: row.escrowAddress,
    status: row.status as Job["status"],
    createdAt: row.createdAt.toISOString(),
    approveTxHash: row.approveTxHash ?? undefined,
    fundingTxHash: row.fundingTxHash ?? undefined,
    doerAddress: row.doerAddress ?? undefined,
    proofMintTxId: row.proofMintTxId ?? undefined,
    payoutTxId: row.payoutTxId ?? undefined,
    submission: row.submissionSubmittedAt
      ? {
          doerAddress: row.doerAddress ?? "",
          note: row.submissionNote ?? undefined,
          attachments: proofAttachments,
          submittedAt: row.submissionSubmittedAt.toISOString(),
          approvedByCreatorAt:
            row.submissionApprovedByCreatorAt?.toISOString() ?? undefined,
        }
      : undefined,
    review: row.reviewRating && row.reviewedAt
      ? {
          rating: row.reviewRating,
          comment: row.reviewComment ?? undefined,
          reviewedAt: row.reviewedAt.toISOString(),
        }
      : undefined,
  };
}

export async function listJobs() {
  const rows = await prisma.job.findMany({
    include: {
      attachments: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => mapJob(row)).filter((job): job is Job => !!job);
}

export async function createJob(input: {
  title: string;
  description?: string;
  briefUrls?: string[];
  rewardUsdc: string;
  creatorAddress: string;
  escrowAddress: string;
}) {
  const row = await prisma.job.create({
    data: {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? null,
      briefUrls: input.briefUrls ? JSON.stringify(input.briefUrls) : null,
      rewardUsdc: input.rewardUsdc,
      creatorAddress: input.creatorAddress.toLowerCase(),
      escrowAddress: input.escrowAddress,
      status: "draft",
    },
    include: { attachments: true },
  });

  const job = mapJob(row);
  if (!job) {
    throw new Error("Failed to create job");
  }

  return job;
}

export async function getJobById(id: string) {
  const row = await prisma.job.findUnique({
    where: { id },
    include: {
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  return mapJob(row);
}

export async function removeUnattendedJob(id: string) {
  await prisma.job.delete({ where: { id } });
}

export async function updateJob(id: string, updates: Partial<Job>) {
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) {
    return undefined;
  }

  await prisma.job.update({
    where: { id },
    data: {
      title: updates.title,
      rewardUsdc: updates.rewardUsdc,
      creatorAddress: updates.creatorAddress?.toLowerCase(),
      escrowAddress: updates.escrowAddress,
      status: updates.status,
      approveTxHash: updates.approveTxHash,
      fundingTxHash: updates.fundingTxHash,
      doerAddress: updates.submission?.doerAddress?.toLowerCase() ?? updates.doerAddress?.toLowerCase(),
      proofMintTxId: updates.proofMintTxId,
      payoutTxId: updates.payoutTxId,
      submissionNote:
        updates.submission === undefined ? undefined : (updates.submission.note ?? null),
      submissionSubmittedAt:
        updates.submission === undefined ? undefined : new Date(updates.submission.submittedAt),
      submissionApprovedByCreatorAt:
        updates.submission === undefined
          ? undefined
          : updates.submission.approvedByCreatorAt
            ? new Date(updates.submission.approvedByCreatorAt)
            : null,
      reviewRating:
        updates.review === undefined ? undefined : updates.review.rating,
      reviewComment:
        updates.review === undefined
          ? undefined
          : (updates.review.comment ?? null),
      reviewedAt:
        updates.review === undefined
          ? undefined
          : new Date(updates.review.reviewedAt),
    },
  });

  return getJobById(id);
}

export async function replaceJobAttachments(
  jobId: string,
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
  }>,
) {
  await prisma.$transaction(async (tx) => {
    // Only replace proof attachments, keep brief attachments
    const existingProof = await tx.jobAttachment.findMany({
      where: { jobId, attachmentType: "proof" },
      select: { id: true },
    });
    const proofIds = existingProof.map((a) => a.id);
    if (proofIds.length > 0) {
      await tx.jobAttachment.deleteMany({ where: { id: { in: proofIds } } });
    }

    for (const attachment of attachments) {
      await tx.jobAttachment.create({
        data: {
          id: attachment.id,
          jobId,
          attachmentType: "proof",
          name: attachment.name,
          contentType: attachment.contentType,
          size: attachment.size,
          storageKey: attachment.storageKey,
          scanStatus: "CLEAN",
        },
      });
    }
  });

  return getJobById(jobId);
}

export async function addBriefAttachments(
  jobId: string,
  attachments: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
  }>,
) {
  for (const attachment of attachments) {
    await prisma.jobAttachment.create({
      data: {
        id: attachment.id,
        jobId,
        attachmentType: "brief",
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
        storageKey: attachment.storageKey,
        scanStatus: "CLEAN", // Creator-uploaded briefs skip scanning
      },
    });
  }

  return getJobById(jobId);
}

export async function getAttachmentById(attachmentId: string) {
  return prisma.jobAttachment.findUnique({
    where: { id: attachmentId },
    include: { job: true },
  });
}

export async function updateAttachmentSignedUrl(attachmentId: string, signedUrl: string, expiresAt: Date) {
  await prisma.jobAttachment.update({
    where: { id: attachmentId },
    data: {
      signedUrl,
      signedUrlExpiresAt: expiresAt,
    },
  });
}

export async function addProof(input: {
  jobId: string;
  ownerAddress: string;
  mintTxId: string;
  tokenUri?: string;
}) {
  const proof = await prisma.proofNft.create({
    data: {
      id: crypto.randomUUID(),
      jobId: input.jobId,
      ownerAddress: input.ownerAddress.toLowerCase(),
      templateId: CIRCLE_ERC721_TEMPLATE_ID,
      mintTxId: input.mintTxId,
      tokenUri: input.tokenUri,
    },
  });

  return {
    id: proof.id,
    jobId: proof.jobId,
    ownerAddress: proof.ownerAddress,
    templateId: proof.templateId,
    tokenUri: proof.tokenUri ?? undefined,
    mintTxId: proof.mintTxId,
    mintedAt: proof.mintedAt.toISOString(),
  } satisfies ProofNft;
}

export async function listProofsForOwner(ownerAddress: string) {
  const rows = await prisma.proofNft.findMany({
    where: { ownerAddress: ownerAddress.toLowerCase() },
    orderBy: { mintedAt: "desc" },
  });

  return rows.map(
    (proof) =>
      ({
        id: proof.id,
        jobId: proof.jobId,
        ownerAddress: proof.ownerAddress,
        templateId: proof.templateId,
        tokenUri: proof.tokenUri ?? undefined,
        mintTxId: proof.mintTxId,
        mintedAt: proof.mintedAt.toISOString(),
      }) satisfies ProofNft,
  );
}
