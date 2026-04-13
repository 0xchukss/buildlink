"use client";

import { useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";

export function WalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending } = useSignMessage();
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function loadSession() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    if (!response.ok) {
      setSessionAddress(null);
      return;
    }

    const payload = (await response.json()) as { address?: string };
    setSessionAddress(payload.address ?? null);
  }

  useEffect(() => {
    loadSession().catch(() => {
      setSessionAddress(null);
    });
  }, [address, isConnected]);

  async function signIn() {
    if (!address) {
      setStatus("Connect wallet first");
      return;
    }

    try {
      setStatus("Requesting sign-in challenge...");
      const challengeResp = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!challengeResp.ok) {
        const payload = (await challengeResp.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to get challenge");
      }

      const challenge = (await challengeResp.json()) as {
        nonce: string;
        message: string;
      };

      setStatus("Waiting for wallet signature...");
      const signature = await signMessageAsync({ message: challenge.message });

      const verifyResp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          nonce: challenge.nonce,
          signature,
        }),
      });

      if (!verifyResp.ok) {
        const payload = (await verifyResp.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to verify signature");
      }

      setStatus("Signed in");
      await loadSession();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed");
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionAddress(null);
    setStatus("Signed out");
  }

  if (!isConnected) {
    return <span className="text-xs text-zinc-500">Connect wallet to sign in</span>;
  }

  const isAuthed = !!address && !!sessionAddress && sessionAddress.toLowerCase() === address.toLowerCase();

  return (
    <div className="flex items-center gap-2">
      {isAuthed ? (
        <>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Signed Session
          </span>
          <button
            type="button"
            onClick={() => signOut().catch(() => setStatus("Sign-out failed"))}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium"
          >
            Logout
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => signIn().catch(() => setStatus("Sign-in failed"))}
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white disabled:bg-zinc-400"
        >
          {isPending ? "Signing..." : "Sign Session"}
        </button>
      )}
      {status ? <span className="text-xs text-zinc-500">{status}</span> : null}
    </div>
  );
}
