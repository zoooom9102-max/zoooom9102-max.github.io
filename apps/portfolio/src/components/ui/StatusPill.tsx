interface StatusPillProps {
  label: string;
  tone?: "orange" | "green" | "neutral";
}

export function StatusPill({ label, tone = "orange" }: StatusPillProps) {
  return (
    <span className="status-pill">
      <span className={`status-pill__dot status-pill__dot--${tone}`} />
      {label}
    </span>
  );
}
