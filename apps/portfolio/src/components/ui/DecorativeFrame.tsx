import type { ReactNode } from "react";

export function DecorativeFrame({ children }: { children: ReactNode }) {
  return (
    <div className="decorative-frame">
      <span className="decorative-frame__corner decorative-frame__corner--tl" />
      <span className="decorative-frame__corner decorative-frame__corner--br" />
      {children}
    </div>
  );
}
