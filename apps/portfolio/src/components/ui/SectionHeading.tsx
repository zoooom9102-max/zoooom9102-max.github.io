interface SectionHeadingProps {
  index: string;
  label: string;
  title: string;
  accent?: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeading({
  index,
  label,
  title,
  accent,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      <p className="section-heading__eyebrow">
        {index} · {label}
      </p>
      <h1>
        {title}
        {accent && <span>{accent}</span>}
      </h1>
      {description && <p className="section-heading__description">{description}</p>}
    </header>
  );
}
