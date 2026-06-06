import { ReactNode } from "react";

type Props = {
  id?: string;
  index: string;
  total: string;
  children: ReactNode;
  className?: string;
  topHairline?: boolean;
  bottomHairline?: boolean;
};

export default function SectionFrame({
  id,
  index,
  total,
  children,
  className = "",
  topHairline = false,
  bottomHairline = false,
}: Props) {
  return (
    <section
      id={id}
      className={`relative w-full bg-ink-950 ${className}`}
    >
      {topHairline && <div className="h-px w-full bg-white/[0.06]" />}
      {/* Section index, top-right, very faint */}
      <div className="pointer-events-none absolute top-6 right-6 md:top-8 md:right-10 select-none">
        <div
          className="font-mono text-[10px] uppercase"
          style={{ letterSpacing: "0.22em", color: "rgba(255,255,255,0.18)" }}
        >
          {index} <span className="opacity-50">/ {total}</span>
        </div>
      </div>
      <div className="relative">{children}</div>
      {bottomHairline && <div className="h-px w-full bg-white/[0.06]" />}
    </section>
  );
}
