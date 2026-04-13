"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import type { ForumPost } from "@/lib/types";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatPostDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-11 w-11 rounded-full border border-zinc-200 object-cover"
      />
    );
  }

  return (
    <div className="grid h-11 w-11 place-items-center rounded-full border border-zinc-300 bg-zinc-100 text-sm font-bold text-zinc-700">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function CommunityForum() {
  const { isConnected } = useAccount();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [body, setBody] = useState("");
  const [postMediaFiles, setPostMediaFiles] = useState<File[]>([]);
  const [replyByPost, setReplyByPost] = useState<Record<string, string>>({});
  const [replyMediaByPost, setReplyMediaByPost] = useState<Record<string, File[]>>({});
  const [message, setMessage] = useState("");

  async function loadPosts() {
    const response = await fetch("/api/forum/posts", { cache: "no-store" });
    const payload = (await response.json()) as { posts?: ForumPost[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load community posts");
    }
    setPosts(payload.posts ?? []);
  }

  useEffect(() => {
    loadPosts().catch((e: unknown) => {
      setMessage(e instanceof Error ? e.message : "Failed to load community posts");
    });
  }, []);

  async function onCreatePost() {
    const postBody = body.trim();

    if (!postBody) {
      setMessage("Post text is required");
      return;
    }

    const formData = new FormData();
    formData.set("body", postBody);
    for (const file of postMediaFiles) {
      formData.append("media", file);
    }

    const response = await fetch("/api/forum/posts", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { posts?: ForumPost[]; error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "Failed to create post");
      return;
    }

    setPosts(payload.posts ?? []);
    setBody("");
    setPostMediaFiles([]);
    setMessage("Post created");
  }

  async function onToggleLike(postId: string) {
    const response = await fetch(`/api/forum/posts/${postId}/like`, { method: "POST" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "Failed to toggle like");
      return;
    }

    await loadPosts();
  }

  async function onReply(postId: string) {
    const reply = (replyByPost[postId] ?? "").trim();
    const replyMedia = replyMediaByPost[postId] ?? [];
    if (!reply && replyMedia.length === 0) {
      return;
    }

    const formData = new FormData();
    formData.set("body", reply);
    for (const file of replyMedia) {
      formData.append("media", file);
    }

    const response = await fetch(`/api/forum/posts/${postId}/replies`, {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "Failed to post reply");
      return;
    }

    setReplyByPost((prev) => ({ ...prev, [postId]: "" }));
    setReplyMediaByPost((prev) => ({ ...prev, [postId]: [] }));
    await loadPosts();
  }

  function renderMedia(media: ForumPost["media"]) {
    return media.map((item, index) => {
      if (item.kind === "image") {
        return (
          <img
            key={`${item.fileName}-${index}`}
            src={item.dataUrl}
            alt={item.fileName}
            className="max-h-80 w-full rounded-xl border border-zinc-200 object-cover"
          />
        );
      }

      if (item.kind === "video") {
        return (
          <video
            key={`${item.fileName}-${index}`}
            src={item.dataUrl}
            controls
            className="max-h-80 w-full rounded-xl border border-zinc-200"
          />
        );
      }

      return (
        <audio
          key={`${item.fileName}-${index}`}
          src={item.dataUrl}
          controls
          className="w-full"
        />
      );
    });
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-zinc-900">Posts</h2>
        <p className="mt-1 text-sm text-zinc-600">Share updates with the BuilderLink community.</p>

        {message ? (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            {message}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={!isConnected}
            placeholder="What's happening?"
            rows={3}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-800 disabled:bg-zinc-100"
          />
          <div className="flex items-center gap-2">
            <label
              htmlFor="post-media-input"
              className={`grid h-10 w-10 place-items-center rounded-full border border-zinc-300 text-2xl font-semibold leading-none ${
                isConnected ? "cursor-pointer bg-white text-zinc-800 hover:bg-zinc-100" : "cursor-not-allowed bg-zinc-100 text-zinc-400"
              }`}
            >
              +
            </label>
            <input
              id="post-media-input"
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              disabled={!isConnected}
              onChange={(event) => setPostMediaFiles(Array.from(event.target.files ?? []))}
              className="sr-only"
            />
            <p className="text-xs text-zinc-500">Add media (image, video, audio)</p>
          </div>
          {postMediaFiles.length > 0 ? (
            <p className="text-xs text-zinc-500">Attached: {postMediaFiles.length} file(s)</p>
          ) : null}
          <button
            type="button"
            disabled={!isConnected}
            onClick={() => {
              onCreatePost().catch(() => undefined);
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Create Post
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {posts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <Avatar
                name={post.authorDisplayName ?? shortAddress(post.authorAddress)}
                avatarUrl={post.authorAvatarUrl}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                  <p className="font-semibold text-zinc-900">
                    {post.authorDisplayName ?? shortAddress(post.authorAddress)}
                  </p>
                  {!post.authorDisplayName ? (
                    <p className="text-zinc-500">@{shortAddress(post.authorAddress)}</p>
                  ) : null}
                  <p className="text-zinc-400">·</p>
                  <p className="text-zinc-500">{formatPostDate(post.createdAt)}</p>
                </div>

                <p className="mt-1 whitespace-pre-line text-sm text-zinc-700">{post.body}</p>
                {post.media.length > 0 ? (
                  <div className="mt-2 space-y-2">{renderMedia(post.media)}</div>
                ) : null}

                <div className="mt-3 flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    disabled={!isConnected}
                    onClick={() => {
                      onToggleLike(post.id).catch(() => undefined);
                    }}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {post.viewerLiked ? "❤️" : "🤍"} {post.likeCount}
                  </button>
                  <span className="text-zinc-500">💬 {post.replies.length}</span>
                </div>

                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Comments</p>
                  <div className="mt-2 space-y-2">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-2 rounded-md border border-zinc-100 bg-white p-2">
                        <Avatar
                          name={reply.authorDisplayName ?? shortAddress(reply.authorAddress)}
                          avatarUrl={reply.authorAvatarUrl}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-700">
                            {reply.authorDisplayName ?? shortAddress(reply.authorAddress)}
                          </p>
                          <p className="text-xs text-zinc-500">{formatPostDate(reply.createdAt)}</p>
                          <p className="mt-1 text-sm text-zinc-700">{reply.body}</p>
                          {reply.media.length > 0 ? (
                            <div className="mt-2 space-y-2">{renderMedia(reply.media)}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {post.replies.length === 0 ? (
                      <p className="text-xs text-zinc-500">No comments yet.</p>
                    ) : null}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <input
                      value={replyByPost[post.id] ?? ""}
                      onChange={(event) =>
                        setReplyByPost((prev) => ({ ...prev, [post.id]: event.target.value }))
                      }
                      disabled={!isConnected}
                      placeholder={isConnected ? "Write a comment" : "Connect wallet to comment"}
                      className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-700 disabled:bg-zinc-100"
                    />
                    <label
                      htmlFor={`reply-media-input-${post.id}`}
                      className={`grid h-8 w-8 place-items-center rounded-full border border-zinc-300 text-lg font-semibold leading-none ${
                        isConnected ? "cursor-pointer bg-white text-zinc-800 hover:bg-zinc-100" : "cursor-not-allowed bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      +
                    </label>
                    <input
                      id={`reply-media-input-${post.id}`}
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*"
                      disabled={!isConnected}
                      onChange={(event) =>
                        setReplyMediaByPost((prev) => ({
                          ...prev,
                          [post.id]: Array.from(event.target.files ?? []),
                        }))
                      }
                      className="sr-only"
                    />
                    <button
                      type="button"
                      disabled={!isConnected}
                      onClick={() => {
                        onReply(post.id).catch(() => undefined);
                      }}
                      className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}

        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            No community posts yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}
