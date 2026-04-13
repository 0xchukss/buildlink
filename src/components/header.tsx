"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletAuth } from "@/components/wallet-auth";

export function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    setTheme(current);
  }, []);

  function onToggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("archire-theme", next);
  }

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: "var(--line)",
        background: "var(--surface)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700">
            Arc Testnet ArcHire
          </p>
          <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
            Trust Through Chain
          </h1>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
          >
            Home
          </Link>
          <Link
            href="/jobs"
            className="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
          >
            Jobs
          </Link>
          <Link
            href="/posts"
            className="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
          >
            Posts
          </Link>
          <Link
            href="/profile"
            className="rounded-full border px-3 py-1 text-sm font-medium transition-colors"
            style={{ borderColor: "var(--line)", color: "var(--ink)", background: "transparent" }}
          >
            Profile
          </Link>
          {/* Theme toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            className="relative flex-shrink-0 cursor-pointer"
            style={{ width: 44, height: 24, padding: 0, border: "none", background: "transparent" }}
          >
            <span
              style={{
                display: "block",
                width: 44,
                height: 24,
                borderRadius: 12,
                background: theme === "dark" ? "var(--accent)" : "var(--line)",
                transition: "background 200ms",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: theme === "dark" ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  transition: "left 200ms",
                }}
              />
              <span className="sr-only">{theme === "dark" ? "Dark mode on" : "Dark mode off"}</span>
            </span>
          </button>
          <WalletAuth />
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
