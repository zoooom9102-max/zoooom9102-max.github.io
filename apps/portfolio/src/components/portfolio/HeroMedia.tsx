import { useEffect, useRef, useState } from "react";
import { useSceneActivity } from "../../hooks/useSceneActivity";
import type { HeroMediaConfig } from "../../types/content";

interface NetworkInformation {
  saveData?: boolean;
}

interface HeroMediaProps {
  config: HeroMediaConfig;
  active: boolean;
  /** The launch gate owns the screen and the hero is not visible through
   *  it — pause decoding until the tile conversion opens gaps again. */
  paused?: boolean;
}

export function HeroMedia({ config, active, paused = false }: HeroMediaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [canPlayVideo, setCanPlayVideo] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const { ref: sceneRef, isActive } = useSceneActivity<HTMLDivElement>({
    rootMargin: "12% 0px",
  });

  useEffect(() => {
    if (!active) {
      setCanPlayVideo(false);
      return;
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = (
      navigator as Navigator & { connection?: NetworkInformation }
    ).connection?.saveData;
    setCanPlayVideo(config.enabled && !reduceMotion && !saveData);
  }, [active, config.enabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !canPlayVideo) return;

    const handleSoundChange = (event: Event) => {
      const enabled = (event as CustomEvent<boolean>).detail;
      setSoundEnabled(enabled);
    };

    const handleVisibility = () => {
      if (document.hidden || !isActive || paused) {
        video.pause();
      } else {
        void video.play().catch(() => undefined);
      }
    };

    video.muted = !soundEnabled;
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("hero-sound-change", handleSoundChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("hero-sound-change", handleSoundChange);
    };
  }, [canPlayVideo, isActive, paused, soundEnabled]);

  return (
    <div
      ref={sceneRef}
      className={`hero-media ${isActive ? "is-scene-active" : ""}`}
      role="img"
      aria-label={config.description}
      style={{ "--hero-focus": config.focalPoint } as React.CSSProperties}
    >
      {config.desktopPoster && (
        <picture>
          {config.mobilePoster && (
            <source media="(max-width: 768px)" srcSet={config.mobilePoster} />
          )}
          <img src={config.desktopPoster} alt="" aria-hidden="true" />
        </picture>
      )}
      {canPlayVideo && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={config.desktopPoster}
          onError={() => setCanPlayVideo(false)}
          aria-hidden="true"
        >
          {(window.matchMedia("(max-width: 768px)").matches &&
          config.mobileSources.length
            ? config.mobileSources
            : config.desktopSources
          ).map((source) => (
            <source key={source.src} {...source} />
          ))}
        </video>
      )}
      <div className="hero-media__veil" />
    </div>
  );
}
