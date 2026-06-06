import { ReactNode } from "react";

type Props = {
  index: string;
  children: ReactNode;
  tone?: "accent" | "muted";
};

export default function Kicker({ index, children, tone = "accent" }: Props) {
  const dotColor = tone === "accent" ? "#00E7FF" : "rgba(255,255,255,0.45)";
  return (
    <div className="flex items-center gap-3 select-none">
      <span
        className="font-mono text-[11px] uppercase"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}
      >
        {index}
      </span>
      <span className="h-px w-8 bg-white/15" />
      <span
        className="font-mono text-[11px] uppercase"
        style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.55)" }}
      >
        {children}
      </span>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: dotColor, boxShadow: tone === "accent" ? "0 0 8px #00E7FF" : "none" }}
      />
    </div>
  );
}
