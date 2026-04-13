"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle, Globe, Plus, Zap } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => {
        if (!active) {
          return;
        }
        setIsAuthenticated(response.ok);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setIsAuthenticated(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCTA = () => {
    router.push("/jobs");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#E4E3E0] text-[#141414]">
      <main className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-32 pt-20 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-block bg-white px-3 py-1 font-mono text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] ring-1 ring-[#141414]">
            The Future of Independent Work
          </div>

          <h1 className="font-serif text-7xl leading-[0.85] tracking-tighter uppercase italic md:text-8xl">
            Build.
            <br />
            Verify.
            <br />
            Earn.
          </h1>

          <p className="max-w-md text-xl leading-relaxed opacity-70">
            ArcHire is the independent marketplace where builders earn opportunities based on reputation and verified work.
          </p>

          <div className="flex flex-wrap gap-4 pt-4">
            <button
              type="button"
              onClick={handleCTA}
              className="group flex items-center gap-3 bg-[#141414] px-8 py-4 text-sm font-bold uppercase tracking-widest text-[#E4E3E0] shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)] transition-all hover:bg-zinc-800 hover:shadow-[4px_4px_0px_0px_rgba(20,20,20,0.4)]"
            >
              {isAuthenticated ? "Enter the Job Board" : "Get Started"}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative flex items-center justify-center"
        >
          <img
            src="https://illustrations.popsy.co/amber/work-from-home.svg"
            alt="Builder Illustration"
            className="h-auto w-full max-w-lg drop-shadow-2xl"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </main>

      <section className="border-t-4 py-24" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div className="space-y-4 bg-[#141414] p-8 text-[#E4E3E0] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] ring-2 ring-[#141414] transition-transform hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center border-2 border-white/20 bg-white/10">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight">Fast Settlement</h3>
              <p className="font-mono text-sm leading-relaxed opacity-60">
                Rewards are released when the creator approves completed work, with transparent on-chain confirmation.
              </p>
            </div>

            <div className="space-y-4 p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] ring-2 ring-[#141414] transition-transform hover:-translate-y-1">
              <div className="flex h-12 w-12 items-center justify-center border-2 border-[#141414] bg-blue-100">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-bold uppercase tracking-tight">Global Network</h3>
              <p className="font-mono text-sm leading-relaxed opacity-60">
                Connect creators and builders globally with proof-first workflows, not gatekeepers.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-32">
        <div className="mb-20">
          <h2 className="font-serif text-5xl font-bold tracking-tighter uppercase italic">How it Works</h2>
          <div className="mt-4 h-2 w-32 bg-[#141414]" />
        </div>

        <div className="space-y-24">
          {[
            {
              num: "01",
              title: "Post a Job",
              desc: "Creators post scoped work with a reward and clear deliverables.",
              icon: <Plus size={32} />,
            },
            {
              num: "02",
              title: "Build & Submit",
              desc: "Doers accept jobs and submit proof files for creator review.",
              icon: <CheckCircle size={32} />,
            },
            {
              num: "03",
              title: "Verify & Earn",
              desc: "Creators approve completion and payouts are released to the doer.",
              icon: <CheckCircle size={32} />,
            },
          ].map((step) => (
            <div key={step.num} className="flex flex-col items-start gap-12 md:flex-row">
              <div className="font-serif text-8xl leading-none font-bold italic opacity-10">{step.num}</div>
              <div className="space-y-4 pt-4">
                <h3 className="flex items-center gap-4 text-3xl font-bold uppercase tracking-tight">
                  {step.icon}
                  {step.title}
                </h3>
                <p className="max-w-2xl text-lg leading-relaxed opacity-60">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t-4 py-12" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
          <div className="font-serif text-2xl font-bold tracking-tighter uppercase italic">ArcHire</div>
          <div className="flex gap-8 font-mono text-[10px] uppercase tracking-widest opacity-40">
            <a href="#" className="transition-opacity hover:opacity-100">Twitter</a>
            <a href="#" className="transition-opacity hover:opacity-100">Discord</a>
            <a href="#" className="transition-opacity hover:opacity-100">Docs</a>
          </div>
          <div className="font-mono text-[10px] uppercase opacity-40">© 2026 ArcHire</div>
        </div>
      </footer>
    </div>
  );
}
