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
      <main className="min-h-screen bg-[#f6f7f9] text-[#17202a] grid place-items-center">
        <div className="border border-[#d9dee7] bg-white px-4 py-3 text-sm text-[#617083]">
          Checking session
        </div>
      </main>
    );
  }

  return <>{children(session)}</>;
}
