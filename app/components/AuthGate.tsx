"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setSession(data.session);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setSession(nextSession);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (checking || !session) {
    return (
      <main className="relative min-h-screen bg-ink-950 text-white grid place-items-center">
        <div className="vignette" aria-hidden />
        <div className="grain" aria-hidden />
        <div className="relative z-10 flex items-center gap-3 border border-white/10 bg-white/[0.02] px-5 py-3 text-sm text-white/70 backdrop-blur-xl">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">Checking session</span>
        </div>
      </main>
    );
  }

  return <>{children(session)}</>;
}
