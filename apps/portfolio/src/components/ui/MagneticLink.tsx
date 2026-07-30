import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { HTMLMotionProps } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface MagneticLinkProps
  extends Omit<HTMLMotionProps<"a">, "style"> {
  maxOffset?: number;
  strength?: number;
}

const spring = {
  stiffness: 360,
  damping: 30,
  mass: 0.42,
};

export function MagneticLink({
  children,
  maxOffset = 5,
  strength = 0.12,
  onPointerMove,
  onPointerLeave,
  ...props
}: MagneticLinkProps) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, spring);
  const springY = useSpring(y, spring);

  const handlePointerMove = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    onPointerMove?.(event);
    if (
      reduceMotion ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX =
      (event.clientX - (bounds.left + bounds.width / 2)) * strength;
    const offsetY =
      (event.clientY - (bounds.top + bounds.height / 2)) * strength;

    x.set(Math.max(-maxOffset, Math.min(maxOffset, offsetX)));
    y.set(Math.max(-maxOffset, Math.min(maxOffset, offsetY)));
  };

  const handlePointerLeave = (
    event: ReactPointerEvent<HTMLAnchorElement>,
  ) => {
    onPointerLeave?.(event);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.a
      {...props}
      data-cursor="interactive"
      style={{ x: springX, y: springY }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.a>
  );
}
