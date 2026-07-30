import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

interface ScrollMappedVideoProps {
  sectionId: string;
  src: string;
  poster?: string;
  children: ReactNode;
  revealStart?: number;
}

const MEDIA_END_PADDING = 0.04;
const CONTACT_PLAYBACK_EXIT_PROGRESS = 0.86;
const MOBILE_QUERY = "(max-width: 768px)";

/**
 * Scroll-scrubbed video following the rockstargames.com/VI "scrollmation"
 * recipe, verified against their production bundle:
 *
 * 1. Desktop fetches the entire video into memory and plays it from a Blob
 *    URL (memory-backed data source); mobile streams the URL directly.
 * 2. Scroll progress maps straight onto `video.currentTime` inside a single
 *    rAF — no damping, no seek epsilon, no WebCodecs.
 * 3. Smoothness comes from the asset, not the runtime: the MP4 must be
 *    H.264, faststart, no B-frames, keyframe every 2 frames (GOP=2).
 */
export function ScrollMappedVideo({
  sectionId,
  src,
  poster,
  children,
  revealStart = 0.84,
}: ScrollMappedVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const section = document.getElementById(sectionId);
    if (!video || !section) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const abortController = new AbortController();
    let scrollFrame: number | null = null;
    let warmupTimer: number | null = null;
    let objectUrl: string | null = null;
    let isDisposed = false;
    let isSceneActive = false;
    let isDocumentVisible = !document.hidden;
    let hasRequestedLoad = false;
    let isPlaybackReady = false;
    let lastProgress = 0;

    const cancelScrollFrame = () => {
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
        scrollFrame = null;
      }
    };

    const hasDuration = () =>
      Number.isFinite(video.duration) && video.duration > 0;

    const getHeaderHeight = () =>
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--header-height",
        ),
      ) || 0;

    const getPlaybackStartTop = (headerHeight = getHeaderHeight()) => {
      return (
        headerHeight +
        Math.max(window.innerHeight - headerHeight, 0) *
          (1 - CONTACT_PLAYBACK_EXIT_PROGRESS)
      );
    };

    const getScrollProgress = (
      sectionTop = section.getBoundingClientRect().top,
      headerHeight = getHeaderHeight(),
    ) => {
      const playbackStartTop = getPlaybackStartTop(headerHeight);
      const scrollRange = Math.max(
        section.offsetHeight - window.innerHeight + playbackStartTop,
        1,
      );
      return Math.min(
        1,
        Math.max(0, (playbackStartTop - sectionTop) / scrollRange),
      );
    };

    const getTimeForProgress = (progress: number) =>
      progress * Math.max(video.duration - MEDIA_END_PADDING, 0);

    const markPlaybackReady = () => {
      if (isDisposed || isPlaybackReady) return;
      isPlaybackReady = true;
      section.classList.remove("is-scroll-video-loading");
      section.classList.add("is-scroll-video-ready");
    };

    const applyProgress = (progress: number) => {
      lastProgress = progress;
      if (!hasDuration() || reducedMotionQuery.matches) return;
      try {
        video.currentTime = getTimeForProgress(progress);
      } catch {
        // A later media event retries once the decoder becomes seekable.
      }
    };

    const updateScrollTarget = () => {
      scrollFrame = null;

      const sectionBounds = section.getBoundingClientRect();
      const sectionTop = sectionBounds.top;
      const headerHeight = getHeaderHeight();
      const isTransitionActive =
        sectionTop <= window.innerHeight && sectionTop > headerHeight;
      const isActuallyVisible =
        sectionBounds.top < window.innerHeight &&
        sectionBounds.bottom > headerHeight;
      const progress = getScrollProgress(sectionTop, headerHeight);
      const revealProgress = Math.min(
        1,
        Math.max(0, (progress - revealStart) / Math.max(1 - revealStart, 0.01)),
      );

      section.classList.toggle(
        "is-contact-transition-active",
        isTransitionActive,
      );
      document.body.classList.toggle(
        "is-contact-scene-active",
        isActuallyVisible,
      );

      applyProgress(progress);

      section.style.setProperty(
        "--contact-reveal-progress",
        String(revealProgress),
      );
      document.documentElement.style.setProperty(
        "--contact-reveal-progress",
        String(revealProgress),
      );
      section.classList.toggle(
        "is-scroll-content-visible",
        progress >= revealStart,
      );
      section.classList.toggle(
        "is-contact-details-visible",
        progress >= revealStart + (1 - revealStart) * 0.28,
      );
      document.body.classList.toggle(
        "is-contact-ending",
        progress >= revealStart,
      );
    };

    const requestScrollUpdate = () => {
      if (
        isDisposed ||
        !isSceneActive ||
        !isDocumentVisible ||
        scrollFrame !== null
      ) {
        return;
      }
      scrollFrame = window.requestAnimationFrame(updateScrollTarget);
    };

    const handleSeeked = () => {
      markPlaybackReady();
    };

    const handleLoadedData = () => {
      // No initial seek needed when the playhead already matches progress 0.
      if (
        reducedMotionQuery.matches ||
        Math.abs(video.currentTime - getTimeForProgress(lastProgress)) < 0.05
      ) {
        markPlaybackReady();
      }
    };

    const handleMotionPreferenceChange = () => {
      if (reducedMotionQuery.matches && hasDuration()) {
        try {
          video.currentTime = 0;
        } catch {
          // Keep the currently decoded frame if seeking is unavailable.
        }
      } else {
        requestScrollUpdate();
      }
    };

    const loadVideo = async () => {
      if (hasRequestedLoad) return;
      hasRequestedLoad = true;
      section.classList.add("is-scroll-video-loading");
      section.classList.remove("is-scroll-video-ready");
      video.pause();

      // Rockstar recipe: on desktop, pull the whole asset into memory and
      // decode from a Blob URL; on mobile, stream the URL directly.
      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      let source = src;
      if (!isMobile) {
        try {
          const response = await fetch(src, {
            signal: abortController.signal,
          });
          if (!response.ok) {
            throw new Error(`scroll video preload failed ${response.status}`);
          }
          const blob = await response.blob();
          if (isDisposed) return;
          objectUrl = URL.createObjectURL(blob);
          source = objectUrl;
        } catch (error) {
          if (isDisposed || abortController.signal.aborted) return;
          console.warn(
            "Scroll video blob preload failed, streaming instead",
            error,
          );
          source = src;
        }
      }

      video.preload = "auto";
      video.src = source;
      video.load();
    };

    const handleVisibilityChange = () => {
      isDocumentVisible = !document.hidden;
      if (!isDocumentVisible) {
        cancelScrollFrame();
        return;
      }
      if (isSceneActive) requestScrollUpdate();
    };

    const sceneObserver = new IntersectionObserver(
      ([entry]) => {
        isSceneActive = entry.isIntersecting;
        section.classList.toggle("is-scene-active", isSceneActive);

        if (!isSceneActive || !isDocumentVisible) {
          document.body.classList.remove("is-contact-scene-active");
          cancelScrollFrame();
          return;
        }

        loadVideo();
        requestScrollUpdate();
      },
      { rootMargin: "100% 0px", threshold: 0 },
    );

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("loadeddata", handleLoadedData);
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    sceneObserver.observe(section);
    warmupTimer = window.setTimeout(loadVideo, 1800);

    return () => {
      isDisposed = true;
      abortController.abort("dispose");
      if (warmupTimer !== null) window.clearTimeout(warmupTimer);
      sceneObserver.disconnect();
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("loadeddata", handleLoadedData);
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener(
        "change",
        handleMotionPreferenceChange,
      );
      section.classList.remove(
        "is-scroll-content-visible",
        "is-contact-details-visible",
        "is-scroll-video-loading",
        "is-scroll-video-ready",
        "is-scene-active",
        "is-contact-transition-active",
      );
      section.style.removeProperty("--contact-reveal-progress");
      document.body.classList.remove("is-contact-ending");
      document.body.classList.remove("is-contact-scene-active");
      document.documentElement.style.removeProperty(
        "--contact-reveal-progress",
      );
      cancelScrollFrame();
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [revealStart, sectionId, src]);

  return (
    <>
      <div className="scroll-mapped-video" aria-hidden="true">
        <video
          ref={videoRef}
          poster={poster}
          muted
          playsInline
          preload="none"
          tabIndex={-1}
        />
        <div className="scroll-mapped-video__veil" />
      </div>
      {children}
    </>
  );
}
