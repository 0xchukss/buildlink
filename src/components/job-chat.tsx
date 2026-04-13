"use client";

import { useEffect, useState } from "react";
import type { JobMessage } from "@/lib/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full border border-zinc-200 object-cover"
      />
    );
  }

  return (
    <div className="grid h-8 w-8 place-items-center rounded-full border border-zinc-300 bg-zinc-100 text-xs font-bold text-zinc-700">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

type JobChatProps = {
  jobId: string;
  canSend: boolean;
};

export function JobChat({ jobId, canSend }: JobChatProps) {
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  async function loadMessages() {
    const response = await fetch(`/api/jobs/${jobId}/chat`, { cache: "no-store" });
    const payload = (await response.json()) as { messages?: JobMessage[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load chat");
    }
    setMessages(payload.messages ?? []);
  }

  useEffect(() => {
    loadMessages().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "Failed to load chat");
    });
  }, [jobId]);

  async function onSend() {
    const body = draft.trim();
    if (!body) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${jobId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = (await response.json()) as { messages?: JobMessage[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send message");
      }

      setMessages(payload.messages ?? []);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Job Discussion (public)
      </p>
      <div className="mt-2 max-h-44 space-y-2 overflow-y-auto rounded-lg bg-white p-2">
        {messages.map((m) => (
          <div key={m.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-2">
            <div className="flex items-center gap-2">
              <Avatar
                name={m.authorDisplayName ?? shortAddress(m.authorAddress)}
                avatarUrl={m.authorAvatarUrl}
              />
              <p className="text-[11px] font-semibold text-zinc-600">
                {m.authorDisplayName ?? shortAddress(m.authorAddress)}
              </p>
            </div>
            <p className="text-sm text-zinc-800">{m.body}</p>
          </div>
        ))}
        {messages.length === 0 ? (
          <p className="text-xs text-zinc-500">No chat yet.</p>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canSend ? "Write a message" : "Only creator/doer can post"}
          disabled={!canSend || isSending}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-700 disabled:bg-zinc-100"
        />
        <button
          type="button"
          onClick={() => {
            onSend().catch(() => undefined);
          }}
          disabled={!canSend || isSending}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Send
        </button>
      </div>
    </div>
  );
}
