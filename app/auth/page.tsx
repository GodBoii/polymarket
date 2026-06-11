"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Mail, Radio } from "lucide-react";
import { supabase } from "../lib/supabase";

type Mode = "signin" | "signup";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] text-white grid place-items-center">
          <div className="border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">Loading auth</div>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => (mode === "signin" ? "Sign in to POLYCOGNITIVE" : "Create your POLYCOGNITIVE account"), [mode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(next);
    });
  }, [next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/dashboard` },
          });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm the account, then sign in.");
      return;
    }

    router.replace(next);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(0,229,255,0.16),transparent_32%),radial-gradient(circle_at_78%_72%,rgba(0,255,136,0.1),transparent_30%)]" />
      <div className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="flex min-h-[42vh] flex-col justify-between px-6 py-6 md:px-12 md:py-10">
          <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-white/60 hover:text-white">
            <ArrowLeft size={16} />
            POLYCOGNITIVE
          </Link>

          <div className="max-w-3xl pb-10">
            <div className="mb-6 inline-flex items-center gap-2 border border-white/12 bg-white/[0.03] px-3 py-2 font-mono text-[11px] uppercase text-white/55">
              <Radio size={14} className="text-accent" />
              World Cup Arena AI Agent
            </div>
            <h1 className="font-display text-5xl leading-none md:text-7xl">Control the agent before it touches the market.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
              Sign in to start live arena agent research, inspect every streamed stage, and review the ledger trail from one operational dashboard.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-white/65 sm:grid-cols-3">
              {["Authenticated starts", "Live stage stream", "Audit-ready history"].map((item) => (
                <div key={item} className="flex items-center gap-2 border border-white/10 bg-white/[0.025] px-3 py-3">
                  <CheckCircle2 size={16} className="text-signal-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center border-t border-white/10 bg-[#f6f7f9] px-5 py-8 text-[#17202a] lg:border-l lg:border-t-0 lg:px-8">
          <form onSubmit={submit} className="w-full border border-[#d9dee7] bg-white p-5 shadow-[0_18px_80px_rgba(0,0,0,0.18)]">
            <div className="mb-5 flex rounded-md border border-[#d9dee7] bg-[#f1f3f7] p-1">
              <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded px-3 py-2 text-sm ${mode === "signin" ? "bg-white shadow-sm" : "text-[#617083]"}`}>
                Sign in
              </button>
              <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded px-3 py-2 text-sm ${mode === "signup" ? "bg-white shadow-sm" : "text-[#617083]"}`}>
                Sign up
              </button>
            </div>

            <h2 className="font-display text-2xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#617083]">Use the Supabase email and password account configured for this project.</p>

            <label className="mt-6 block text-sm font-medium">
              Email
              <span className="mt-2 flex items-center gap-2 border border-[#d9dee7] px-3 py-2">
                <Mail size={16} className="text-[#617083]" />
                <input className="w-full outline-none" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </span>
            </label>

            <label className="mt-4 block text-sm font-medium">
              Password
              <span className="mt-2 flex items-center gap-2 border border-[#d9dee7] px-3 py-2">
                <LockKeyhole size={16} className="text-[#617083]" />
                <input className="w-full outline-none" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </span>
            </label>

            {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {message && <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

            <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 bg-[#0f8b8d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {loading ? "Working" : mode === "signin" ? "Open dashboard" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
