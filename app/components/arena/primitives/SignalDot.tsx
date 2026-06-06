type Props = {
  color?: string;
  size?: number;
  pulse?: boolean;
};

export default function SignalDot({ color = "#00E7FF", size = 8, pulse = true }: Props) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: color, opacity: 0.16, animation: pulse ? "pulse-soft 2.4s ease-in-out infinite" : undefined }}
      />
      <span className="relative rounded-full" style={{ width: size * 0.45, height: size * 0.45, background: color, boxShadow: `0 0 ${size}px ${color}` }} />
    </span>
  );
}
