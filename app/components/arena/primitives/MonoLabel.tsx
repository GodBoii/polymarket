import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "faint" | "accent";
};

export default function MonoLabel({ children, className = "", tone = "muted" }: Props) {
  const color =
    tone === "faint" ? "rgba(255,255,255,0.32)" : tone === "accent" ? "#00E7FF" : "rgba(255,255,255,0.55)";
  return (
    <span
      className={`font-mono text-[10px] uppercase ${className}`}
      style={{ letterSpacing: "0.22em", color }}
    >
      {children}
    </span>
  );
}
