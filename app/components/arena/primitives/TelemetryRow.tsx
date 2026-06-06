import MonoLabel from "./MonoLabel";

type Props = {
  label: string;
  value: string;
  unit?: string;
  delta?: number;
  tone?: "default" | "success" | "danger";
  size?: "md" | "lg";
};

export default function TelemetryRow({ label, value, unit, delta, tone = "default", size = "md" }: Props) {
  const deltaColor =
    tone === "success" ? "#00FF88" : tone === "danger" ? "#FF5959" : "rgba(255,255,255,0.55)";
  const valueSize = size === "lg" ? "text-3xl md:text-4xl" : "text-xl md:text-2xl";
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <MonoLabel tone="muted">{label}</MonoLabel>
      <div className="flex items-baseline gap-2">
        <span className={`arena-num text-white ${valueSize}`}>{value}</span>
        {unit && <MonoLabel tone="faint">{unit}</MonoLabel>}
        {delta !== undefined && (
          <span
            className="font-mono text-[11px]"
            style={{ color: deltaColor, letterSpacing: "0.04em" }}
          >
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "·"} {Math.abs(delta).toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}
