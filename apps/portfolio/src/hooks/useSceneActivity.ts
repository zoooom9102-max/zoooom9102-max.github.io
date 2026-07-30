import { useEffect, useRef, useState } from "react";

interface SceneActivityOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useSceneActivity<T extends HTMLElement>({
  rootMargin = "20% 0px",
  threshold = 0,
}: SceneActivityOptions = {}) {
  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    () => !document.hidden,
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { rootMargin, threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    ref,
    isActive: isIntersecting && isDocumentVisible,
  };
}
