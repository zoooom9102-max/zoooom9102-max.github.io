import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export function SmoothScroll() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia(reducedMotionQuery).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(reducedMotionQuery);
    const handleChange = () => setReducedMotion(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  if (reducedMotion) return null;

  return (
    <ReactLenis
      root
      options={{
        autoRaf: true,
        lerp: 0.075,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.82,
        touchMultiplier: 1,
        anchors: true,
        stopInertiaOnNavigate: true,
      }}
    />
  );
}
