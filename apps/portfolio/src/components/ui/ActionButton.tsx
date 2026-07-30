import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface ActionButtonProps {
  to: string;
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
}

export function ActionButton({
  to,
  children,
  variant = "solid",
  className = "",
}: ActionButtonProps) {
  return (
    <Link
      to={to}
      className={`action-button action-button--${variant} ${className}`}
    >
      {children}
    </Link>
  );
}
