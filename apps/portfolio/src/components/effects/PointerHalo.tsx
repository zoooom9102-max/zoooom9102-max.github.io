import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useEffect, useState } from "react";

type PointerMode = "idle" | "interactive" | "project";

const spring = {
  stiffness: 520,
  damping: 42,
  mass: 0.45,
};

export function PointerHalo() {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(-120);
  const pointerY = useMotionValue(-120);
  const haloX = useSpring(pointerX, spring);
  const haloY = useSpring(pointerY, spring);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<PointerMode>("idle");

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    const updateCapability = () => {
      const enabled = finePointer.matches && !reduceMotion;
      setIsEnabled(enabled);
      document.documentElement.classList.toggle("has-custom-pointer", enabled);
      if (!enabled) setIsVisible(false);
    };

    updateCapability();
    finePointer.addEventListener("change", updateCapability);
    return () => {
      finePointer.removeEventListener("change", updateCapability);
      document.documentElement.classList.remove("has-custom-pointer");
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (!isEnabled) return;

    let currentMode: PointerMode = "idle";

    const handlePointerMove = (event: PointerEvent) => {
      pointerX.set(event.clientX);
      pointerY.set(event.clientY);
      setIsVisible(true);

      const target = event.target;
      const element = target instanceof Element ? target : null;
      const nextMode: PointerMode = element?.closest('[data-cursor="project"]')
        ? "project"
        : element?.closest('a, button, [data-cursor="interactive"]')
          ? "interactive"
          : "idle";

      if (nextMode !== currentMode) {
        currentMode = nextMode;
        setMode(nextMode);
      }
    };

    const hidePointer = () => setIsVisible(false);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", hidePointer);
    window.addEventListener("blur", hidePointer);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", hidePointer);
      window.removeEventListener("blur", hidePointer);
    };
  }, [haloX, haloY, isEnabled, pointerX, pointerY]);

  if (!isEnabled) return null;

  return (
    <div
      className={`pointer-halo pointer-halo--${mode} ${
        isVisible ? "is-visible" : ""
      }`}
      aria-hidden="true"
    >
      <motion.div
        className="pointer-halo__follower"
        style={{ x: haloX, y: haloY }}
      >
        <span className="pointer-halo__ring" />
      </motion.div>
      <motion.div
        className="pointer-halo__point"
        style={{ x: pointerX, y: pointerY }}
      >
        <span />
      </motion.div>
    </div>
  );
}
