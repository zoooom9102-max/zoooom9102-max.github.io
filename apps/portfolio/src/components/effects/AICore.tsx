import { useEffect, useRef } from "react";

const NODE_COUNT = 12;

export function AICore() {
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const core = coreRef.current;
    if (!core) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const finePointerQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    );
    let animationFrame: number | null = null;
    let targetX = -7;
    let targetY = 0;

    const commitTilt = () => {
      animationFrame = null;
      core.style.setProperty("--core-rotate-x", `${targetX}deg`);
      core.style.setProperty("--core-rotate-y", `${targetY}deg`);
    };

    const requestTilt = () => {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(commitTilt);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (reducedMotionQuery.matches || !finePointerQuery.matches) return;
      const rect = core.getBoundingClientRect();
      const horizontal = (event.clientX - rect.left) / rect.width - 0.5;
      const vertical = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = -7 - vertical * 12;
      targetY = horizontal * 16;
      requestTilt();
    };

    const resetTilt = () => {
      targetX = -7;
      targetY = 0;
      requestTilt();
    };

    core.addEventListener("pointermove", handlePointerMove, { passive: true });
    core.addEventListener("pointerleave", resetTilt);

    return () => {
      core.removeEventListener("pointermove", handlePointerMove);
      core.removeEventListener("pointerleave", resetTilt);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div ref={coreRef} className="ai-core" aria-hidden="true">
      <div className="ai-core__coordinates ai-core__coordinates--top">
        X 31.230 / Y 07.120
      </div>
      <div className="ai-core__scene">
        <div className="ai-core__halo" />
        <div className="ai-core__orbit ai-core__orbit--one">
          <i />
          <i />
          <i />
        </div>
        <div className="ai-core__orbit ai-core__orbit--two">
          <i />
          <i />
        </div>
        <div className="ai-core__orbit ai-core__orbit--three" />
        <div className="ai-core__nodes">
          {Array.from({ length: NODE_COUNT }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--node-index": index,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="ai-core__center">
          <span>WL</span>
        </div>
      </div>
      <div className="ai-core__coordinates ai-core__coordinates--bottom">
        MODEL / CREATIVE SYSTEM
      </div>
    </div>
  );
}
