"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getAddress, parseUnits } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { ARC_USDC_ADDRESS, ARC_USDC_DECIMALS } from "@/lib/constants";
import type { Job } from "@/lib/types";
import { JobChat } from "@/components/job-chat";

const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function BuilderFeed() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [briefUrls, setBriefUrls] = useState("");
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [rewardUsdc, setRewardUsdc] = useState("");
  const [noteByJob, setNoteByJob] = useState<Record<string, string>>({});
  const [attachmentsByJob, setAttachmentsByJob] = useState<
    Record<string, File[]>
  >({});
  const [reviewRatingByJob, setReviewRatingByJob] = useState<Record<string, string>>({});
  const [reviewCommentByJob, setReviewCommentByJob] = useState<Record<string, string>>({});
  const [pendingByJob, setPendingByJob] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>("");

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== "paid"),
    [jobs],
  );

  const historyJobs = useMemo(
    () =>
      jobs.filter((job) => {
        if (job.status !== "paid") {
          return false;
        }

        if (!address) {
          return false;
        }

        const lower = address.toLowerCase();
        const doer = (job.submission?.doerAddress ?? job.doerAddress ?? "").toLowerCase();
        return lower === job.creatorAddress.toLowerCase() || lower === doer;
      }),
    [address, jobs],
  );

  async function refreshJobs() {
    const response = await fetch("/api/jobs", { cache: "no-store" });
    const payload = (await response.json()) as { jobs: Job[] };
    setJobs(payload.jobs ?? []);
  }

  useEffect(() => {
    refreshJobs().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Failed to load jobs");
    });
  }, []);

  async function onCreateJob() {
    if (!address) {
      setMessage("Connect wallet to create a job");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("rewardUsdc", rewardUsdc);
    formData.append("briefUrls", briefUrls);
    for (const file of briefFiles) {
      formData.append("briefFiles", file);
    }

    const response = await fetch("/api/jobs", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Could not create job");
    }

    setTitle("");
    setDescription("");
    setBriefUrls("");
    setBriefFiles([]);
    setRewardUsdc("");
    setIsCreateOpen(false);
    await refreshJobs();
    setMessage("Job posted. Fund it to move into escrow.");
  }

  async function onFundJob(job: Job) {
    if (!address || !publicClient) {
      setMessage("Connect wallet before funding a job");
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const amount = parseUnits(job.rewardUsdc, ARC_USDC_DECIMALS);
      const escrowChecksummed = getAddress(job.escrowAddress);
      const approveHash = await writeContractAsync({
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [escrowChecksummed, amount],
        chainId: 5042002,
      });

      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const transferHash = await writeContractAsync({
        address: ARC_USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [escrowChecksummed, amount],
        chainId: 5042002,
      });

      await publicClient.waitForTransactionReceipt({ hash: transferHash });

      const verifyResponse = await fetch(`/api/jobs/${job.id}/monitor-funding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approveTxHash: approveHash,
          txHash: transferHash,
        }),
      });

      if (!verifyResponse.ok) {
        const payload = (await verifyResponse.json()) as { error?: string };
        throw new Error(payload.error ?? "Funding monitor check failed");
      }

      setMessage("Escrow funded and marked via Circle monitor checks.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Funding failed");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  async function onSubmitForReview(job: Job) {
    if (!address) {
      setMessage("Connect wallet to submit completion proof");
      return;
    }

    const files = attachmentsByJob[job.id] ?? [];
    if (files.length === 0) {
      setMessage("Attach at least one screenshot, doc, or PDF");
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const formData = new FormData();
      formData.append("note", noteByJob[job.id] ?? "");
      for (const file of files) {
        formData.append("attachments", file);
      }

      const response = await fetch(`/api/jobs/${job.id}/complete`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Completion failed");
      }

      setMessage("Submission sent. Waiting for creator approval.");
      setNoteByJob((prev) => ({ ...prev, [job.id]: "" }));
      setAttachmentsByJob((prev) => ({ ...prev, [job.id]: [] }));
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Completion failed");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  async function onApproveSubmission(job: Job) {
    if (!address) {
      setMessage("Connect wallet to approve a submission");
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const response = await fetch(`/api/jobs/${job.id}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Approval failed");
      }

      setMessage("Submission approved. Doer can now claim reward.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  async function onClaimReward(job: Job) {
    if (!address) {
      setMessage("Connect wallet to claim reward");
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const response = await fetch(`/api/jobs/${job.id}/claim`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Claim failed");
      }

      setMessage("Reward claimed. Payout submitted. NFT mint runs only if enabled.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  async function onSubmitReview(job: Job) {
    if (!address) {
      setMessage("Connect wallet to submit a review");
      return;
    }

    const rawRating = reviewRatingByJob[job.id] ?? "";
    const rating = Number(rawRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setMessage("Rating must be a number between 1 and 5");
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const response = await fetch(`/api/jobs/${job.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: reviewCommentByJob[job.id] ?? "",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Review submission failed");
      }

      setMessage("Review submitted.");
      setReviewRatingByJob((prev) => ({ ...prev, [job.id]: "" }));
      setReviewCommentByJob((prev) => ({ ...prev, [job.id]: "" }));
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review submission failed");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  async function onRemoveJob(job: Job) {
    if (!address) {
      setMessage("Connect wallet to remove a job");
      return;
    }

    const confirmed = window.confirm(
      "Remove this unattended job? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setPendingByJob((prev) => ({ ...prev, [job.id]: true }));

    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to remove job");
      }

      setMessage("Job removed.");
      await refreshJobs();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to remove job");
    } finally {
      setPendingByJob((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <div className="mb-6 rounded-3xl border border-amber-300/70 bg-gradient-to-r from-amber-50 via-white to-rose-50 p-6">
        <p className="text-sm text-zinc-700">
          Use faucet USDC on Arc for testing. Your EOA handles approve + transfer and needs ARC for gas.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-700"
            disabled={!isConnected}
          >
            Create Job
          </button>
          <Link
            href="/"
            className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          >
            Back to Landing
          </Link>
          {!isConnected ? (
            <span className="self-center text-sm font-bold text-zinc-700">Create or Accept Jobs</span>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-700">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4">
        {activeJobs.map((job) => {
          const isPending = !!pendingByJob[job.id];
          const isCreator =
            !!address && address.toLowerCase() === job.creatorAddress.toLowerCase();
          const isDoer =
            !!address &&
            !!job.doerAddress &&
            address.toLowerCase() === job.doerAddress.toLowerCase();
          const hasAnyDoerActivity =
            !!job.doerAddress ||
            !!job.submission?.doerAddress ||
            !!job.submission?.submittedAt;
          const canRemoveUnattended =
            isCreator && !hasAnyDoerActivity && (job.status === "draft" || job.status === "funding_pending" || job.status === "funded");
          const canSendChat = !!address && (isCreator || isDoer || !job.doerAddress);

          return (
            <article
              key={job.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">{job.title}</h3>
                  <p className="text-sm text-zinc-500">Reward: {job.rewardUsdc} USDC</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-700">
                    {job.status.replaceAll("_", " ")}
                  </span>
                  {canRemoveUnattended ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onRemoveJob(job)}
                      className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Remove Job
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {/* Job brief — visible to everyone */}
                {(job.description || job.briefUrls.length > 0 || job.briefAttachments.length > 0) && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-zinc-700">
                    {job.description ? (
                      <p className="mb-2 whitespace-pre-line">{job.description}</p>
                    ) : null}
                    {job.briefUrls.length > 0 ? (
                      <ul className="mb-2 space-y-1">
                        {job.briefUrls.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer" className="text-blue-700 underline break-all text-xs">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {job.briefAttachments.length > 0 ? (
                      <ul className="space-y-1">
                        {job.briefAttachments.map((a) => (
                          <li key={a.id}>
                            <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-700 underline text-xs">
                              {a.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )}

                {/* Doer submission inputs — only for non-creator connected wallets */}
                {address && address.toLowerCase() !== job.creatorAddress.toLowerCase() ? (
                  <>
                    <input
                      value={noteByJob[job.id] ?? ""}
                      onChange={(event) =>
                        setNoteByJob((prev) => ({ ...prev, [job.id]: event.target.value }))
                      }
                      placeholder="Add a review note for creator"
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                    />
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx"
                      onChange={(event) =>
                        setAttachmentsByJob((prev) => ({
                          ...prev,
                          [job.id]: Array.from(event.target.files ?? []),
                        }))
                      }
                      className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </>
                ) : null}

                {/* Proof attachments — only visible to creator and doer */}
                {(() => {
                  const proofDoer = (job.submission?.doerAddress ?? job.doerAddress ?? "").toLowerCase();
                  const canSeeProof =
                    address &&
                    (address.toLowerCase() === job.creatorAddress.toLowerCase() ||
                      (proofDoer && address.toLowerCase() === proofDoer));
                  return canSeeProof && (job.submission?.attachments.length ?? 0) > 0 ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Proof (private)</p>
                      <ul className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                        {job.submission?.attachments.map((attachment) => (
                          <li key={attachment.url}>
                            <a href={attachment.url} target="_blank" rel="noreferrer" className="underline">
                              {attachment.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null;
                })()}

                <JobChat jobId={job.id} canSend={canSendChat} />

                {/* Disconnected state */}
                {!address && (
                  <p className="text-center text-base font-bold text-zinc-700">
                    Create or Accept Jobs
                  </p>
                )}
                {/* Creator-only actions */}
                {address && address.toLowerCase() === job.creatorAddress.toLowerCase() && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isPending || job.status !== "draft"}
                      onClick={() => onFundJob(job)}
                      className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-200"
                    >
                      Fund Escrow
                    </button>
                    <button
                      type="button"
                      disabled={isPending || job.status !== "submitted_for_review"}
                      onClick={() => onApproveSubmission(job)}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Creator Approve
                    </button>
                  </div>
                )}
                {/* Doer-only actions */}
                {address && address.toLowerCase() !== job.creatorAddress.toLowerCase() && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={isPending || job.status !== "funded"}
                      onClick={() => onSubmitForReview(job)}
                      className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Submit Proof Files
                    </button>
                    <button
                      type="button"
                      disabled={
                        isPending ||
                        job.status !== "approved_for_claim" ||
                        address.toLowerCase() !==
                          (job.submission?.doerAddress ?? job.doerAddress ?? "").toLowerCase()
                      }
                      onClick={() => onClaimReward(job)}
                      className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Claim Reward
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {activeJobs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            No active jobs yet.
          </p>
        ) : null}
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-900">Job History</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Completed jobs where you are the creator or the doer.
        </p>

        <div className="mt-4 grid gap-4">
          {!address ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
              Connect wallet to view your job history.
            </p>
          ) : null}

          {address && historyJobs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500">
              No completed jobs in your history yet.
            </p>
          ) : null}

          {address
            ? historyJobs.map((job) => {
                const isPending = !!pendingByJob[job.id];
                const isCreator = address.toLowerCase() === job.creatorAddress.toLowerCase();

                return (
                  <article
                    key={`history-${job.id}`}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900">{job.title}</h3>
                        <p className="text-sm text-zinc-500">Reward paid: {job.rewardUsdc} USDC</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-800">
                        completed
                      </span>
                    </div>

                    {job.review ? (
                      <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                        <p className="font-semibold">Creator review: {job.review.rating}/5</p>
                        {job.review.comment ? (
                          <p className="mt-1 text-zinc-600">{job.review.comment}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {isCreator && !job.review ? (
                      <div className="mt-4 space-y-3">
                        <input
                          value={reviewRatingByJob[job.id] ?? ""}
                          onChange={(event) =>
                            setReviewRatingByJob((prev) => ({
                              ...prev,
                              [job.id]: event.target.value,
                            }))
                          }
                          placeholder="Rating (1-5)"
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                        />
                        <textarea
                          value={reviewCommentByJob[job.id] ?? ""}
                          onChange={(event) =>
                            setReviewCommentByJob((prev) => ({
                              ...prev,
                              [job.id]: event.target.value,
                            }))
                          }
                          placeholder="Write feedback for the doer"
                          rows={3}
                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                        />
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => onSubmitReview(job)}
                          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                        >
                          Submit Review
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            : null}
        </div>
      </div>

      {isCreateOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl my-8">
            <h2 className="text-xl font-semibold text-zinc-900">Create Job</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Job Title *</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Build landing page"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe what you need done, requirements, deliverables, deadline…"
                  rows={4}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Reference URLs <span className="font-normal text-zinc-400">(one per line)</span></label>
                <textarea
                  value={briefUrls}
                  onChange={(event) => setBriefUrls(event.target.value)}
                  placeholder={"https://figma.com/file/...\nhttps://docs.example.com/..."}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Attach Brief Files <span className="font-normal text-zinc-400">(designs, specs, docs)</span></label>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx"
                  onChange={(event) => setBriefFiles(Array.from(event.target.files ?? []))}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                />
                {briefFiles.length > 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">{briefFiles.length} file(s) selected</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">Reward (USDC) *</label>
                <input
                  value={rewardUsdc}
                  onChange={(event) => setRewardUsdc(event.target.value)}
                  placeholder="25.5"
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  onCreateJob().catch((error: unknown) => {
                    setMessage(
                      error instanceof Error ? error.message : "Could not create job",
                    );
                  })
                }
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Post Job
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
