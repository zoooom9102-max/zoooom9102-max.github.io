import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  ariaLabel?: string;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  distance = 20,
  ariaLabel,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={`reveal-block ${className}`}
      aria-label={ariaLabel}
      initial={reduceMotion ? false : { opacity: 0, y: distance }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: 0.58,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
