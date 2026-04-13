export type JobStatus =
  | "draft"
  | "funding_pending"
  | "funded"
  | "submitted_for_review"
  | "approved_for_claim"
  | "proof_minted"
  | "paid";

export type JobAttachment = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  attachmentType: "brief" | "proof";
  scanStatus: "queued" | "clean" | "infected" | "error";
  scanDetails?: string;
};

export type JobSubmission = {
  doerAddress: string;
  note?: string;
  attachments: JobAttachment[];
  submittedAt: string;
  approvedByCreatorAt?: string;
};

export type JobReview = {
  rating: number;
  comment?: string;
  reviewedAt: string;
};

export type Job = {
  id: string;
  title: string;
  description?: string;
  briefUrls: string[];
  briefAttachments: JobAttachment[];
  rewardUsdc: string;
  creatorAddress: string;
  escrowAddress: string;
  status: JobStatus;
  createdAt: string;
  approveTxHash?: string;
  fundingTxHash?: string;
  doerAddress?: string;
  submission?: JobSubmission;
  review?: JobReview;
  proofMintTxId?: string;
  payoutTxId?: string;
};

export type ProofNft = {
  id: string;
  jobId: string;
  ownerAddress: string;
  templateId: string;
  tokenUri?: string;
  mintTxId: string;
  mintedAt: string;
};

export type JobMessage = {
  id: string;
  jobId: string;
  authorAddress: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  body: string;
  createdAt: string;
};

export type ProfileSocials = {
  twitter?: string;
  github?: string;
  website?: string;
  telegram?: string;
  discord?: string;
};

export type UserProfile = {
  address: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  socials: ProfileSocials;
};

export type ForumReply = {
  id: string;
  postId: string;
  authorAddress: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  body: string;
  media: Array<{
    kind: "image" | "video" | "audio";
    contentType: string;
    dataUrl: string;
    fileName: string;
  }>;
  createdAt: string;
};

export type ForumPost = {
  id: string;
  authorAddress: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  title: string;
  body: string;
  media: Array<{
    kind: "image" | "video" | "audio";
    contentType: string;
    dataUrl: string;
    fileName: string;
  }>;
  likeCount: number;
  viewerLiked: boolean;
  createdAt: string;
  replies: ForumReply[];
};
