"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import { supabase } from "../../../lib/supabase";

const FinalCollapse = dynamic(() => import("../scenes/FinalCollapse"), { ssr: false });

export default function Final() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (mounted) setSignedIn(!!(data.session as { user?: unknown } | null)?.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: unknown, session: unknown) => {
      if (mounted) setSignedIn(!!(session as { user?: unknown } | null)?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const goFollow = () => {
    if (signedIn) router.push("/dashboard");
    else router.push("/auth?next=/dashboard");
  };

  return (
    <section
      id="final"
      className="relative w-full bg-ink-950 overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      <div className="absolute inset-0">
        <FinalCollapse />
      </div>

      <div className="relative z-10 h-screen flex flex-col items-center justify-center page-x text-center">
        <Kicker index="07">THE END</Kicker>
        <h2
          className="arena-display text-white mt-6 max-w-6xl"
          style={{ fontSize: "clamp(56px, 8vw, 140px)" }}
        >
          THE&nbsp;FUTURE<br />
          <span className="text-white">LEAVES&nbsp;CLUES.</span>
          <br />
          <span className="text-accent">WE&nbsp;FIND&nbsp;THEM.</span>
        </h2>
        <p className="mt-8 text-white/55 text-base md:text-lg max-w-xl">
          A new forecast every 1.4 seconds. Updated continuously, audited in full.
        </p>
        <button onClick={goFollow} className="btn btn-primary mt-10">
          Follow Our Journey
          <ArrowUpRight size={16} />
        </button>

        <div className="absolute bottom-10 left-0 right-0 px-6 md:px-10 flex items-center justify-between text-white/40 text-[10px] font-mono" style={{ letterSpacing: "0.18em" }}>
          <span>STAIR AI ARENA · STAGE 04 / 12</span>
          <span>MODEL v3.1.0 · POLY-09</span>
        </div>
      </div>
    </section>
  );
}
