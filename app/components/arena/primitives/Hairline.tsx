type Props = { strong?: boolean; className?: string };

export default function Hairline({ strong = false, className = "" }: Props) {
  return (
    <div
      className={`h-px w-full ${className}`}
      style={{ background: strong ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)" }}
    />
  );
}
