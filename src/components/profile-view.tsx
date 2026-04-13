"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { ProofNft, UserProfile } from "@/lib/types";

export function ProfileView() {
  const { address, isConnected } = useAccount();
  const [proofs, setProofs] = useState<ProofNft[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("");

  async function onPickAvatar(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file for your profile picture.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Profile picture must be 2MB or smaller.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            avatarUrl: dataUrl,
          }
        : prev,
    );
    setMessage("Profile picture selected. Save profile to publish it.");
  }

  useEffect(() => {
    async function load() {
      if (!address) {
        setProofs([]);
        setProfile(null);
        return;
      }

      const profileResponse = await fetch("/api/profile/me", { cache: "no-store" });
      if (profileResponse.ok) {
        const profilePayload = (await profileResponse.json()) as { profile: UserProfile };
        setProfile(profilePayload.profile);
      } else if (profileResponse.status === 401) {
        // Server restart expires auth cookie; still show public profile by connected wallet.
        const publicProfileResponse = await fetch(`/api/profile/${address}`, {
          cache: "no-store",
        });
        if (!publicProfileResponse.ok) {
          const payload = (await publicProfileResponse.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to load profile");
        }
        const profilePayload = (await publicProfileResponse.json()) as {
          profile: UserProfile;
        };
        setProfile(profilePayload.profile);
      } else {
        const payload = (await profileResponse.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load profile");
      }

      const response = await fetch(`/api/profile/${address}/proofs`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to load profile proofs");
      }

      const payload = (await response.json()) as { proofs: ProofNft[] };
      setProofs(payload.proofs ?? []);
    }

    load().catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : "Unable to load proofs");
    });
  }, [address]);

  async function onSaveProfile() {
    if (!profile) {
      return;
    }

    const response = await fetch("/api/profile/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: profile.displayName ?? "",
        bio: profile.bio ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        socials: profile.socials,
      }),
    });

    const payload = (await response.json()) as { profile?: UserProfile; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to save profile");
    }

    if (payload.profile) {
      setProfile(payload.profile);
    }
    setMessage("Profile saved");
  }

  if (!isConnected || !address) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
        <p className="rounded-2xl border border-zinc-300 bg-white p-6 text-sm text-zinc-700">
          Connect your wallet to see your Proof of Work NFTs.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <h2 className="text-2xl font-semibold text-zinc-900">Your Profile</h2>
      {profile?.displayName ? (
        <p className="mt-1 text-sm text-zinc-500">Display name: {profile.displayName}</p>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">Wallet: {address}</p>
      )}

      {profile ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Public Profile</h3>
          <div className="mt-3 flex items-center gap-4">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Profile avatar"
                className="h-16 w-16 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full border border-zinc-300 bg-zinc-100 text-lg font-bold text-zinc-700">
                {(profile.displayName ?? address).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Profile picture
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => {
                  onPickAvatar(event.target.files?.[0] ?? null).catch((error: unknown) => {
                    setMessage(
                      error instanceof Error ? error.message : "Failed to load profile picture",
                    );
                  });
                }}
                className="block text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
              />
              {profile.avatarUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            avatarUrl: "",
                          }
                        : prev,
                    )
                  }
                  className="text-xs font-semibold text-rose-700 underline"
                >
                  Remove picture
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={profile.displayName ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        displayName: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder="Display name"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
            <input
              value={profile.avatarUrl ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        avatarUrl: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder="Avatar image URL (optional)"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
          </div>

          <textarea
            value={profile.bio ?? ""}
            onChange={(event) =>
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      bio: event.target.value,
                    }
                  : prev,
              )
            }
            placeholder="Short bio"
            rows={3}
            className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
          />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              value={profile.socials.twitter ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        socials: { ...prev.socials, twitter: event.target.value },
                      }
                    : prev,
                )
              }
              placeholder="Twitter/X URL"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
            <input
              value={profile.socials.github ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        socials: { ...prev.socials, github: event.target.value },
                      }
                    : prev,
                )
              }
              placeholder="GitHub URL"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
            <input
              value={profile.socials.website ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        socials: { ...prev.socials, website: event.target.value },
                      }
                    : prev,
                )
              }
              placeholder="Website URL"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
            <input
              value={profile.socials.telegram ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        socials: { ...prev.socials, telegram: event.target.value },
                      }
                    : prev,
                )
              }
              placeholder="Telegram handle/link"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800"
            />
            <input
              value={profile.socials.discord ?? ""}
              onChange={(event) =>
                setProfile((prev) =>
                  prev
                    ? {
                        ...prev,
                        socials: { ...prev.socials, discord: event.target.value },
                      }
                    : prev,
                )
              }
              placeholder="Discord username"
              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800 sm:col-span-2"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onSaveProfile().catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : "Failed to save profile");
              });
            }}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Save Profile
          </button>
        </div>
      ) : null}

      <h2 className="mt-8 text-2xl font-semibold text-zinc-900">Your Proof of Work NFTs</h2>

      {message ? (
        <p className="mt-4 rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-700">
          {message}
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {proofs.map((proof) => (
          <article
            key={proof.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-zinc-800">Job #{proof.jobId.slice(0, 8)}</p>
            <p className="mt-1 text-xs text-zinc-500">Template: {proof.templateId}</p>
            <p className="mt-1 text-xs text-zinc-500">Mint Tx Id: {proof.mintTxId}</p>
            {proof.tokenUri ? (
              <a
                href={proof.tokenUri}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-sm font-medium text-amber-700 underline"
              >
                View Proof URI
              </a>
            ) : null}
          </article>
        ))}

        {proofs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
            No minted proof NFTs yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
