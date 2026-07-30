import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLenis } from "lenis/react";
import { X } from "lucide-react";
import { designWorks } from "../../data/designWorks";
import type { DesignWork } from "../../data/designWorks";

/**
 * Showcase item 05 — 设计作品 gallery strip.
 * Reverse-engineered from olivergareis.com (GSAP horizontalLoop + Draggable
 * + InertiaPlugin, bundle-verified):
 *   - the auto loop does NOT pause on press/hover — only a real drag
 *     (beyond the threshold) takes over, 1:1 pixel tracking, no lerp;
 *   - release throws with sampled velocity, exponential friction;
 *   - the throw settles into a SNAP to the nearest card edge
 *     (reference: snap() → getClosest(times), overshootTolerance 0);
 *   - while pressed, cards shrink (reference `.is-pressed` class).
 * A click that did not travel opens the lightbox — a vertically scrollable
 * overlay with every image; blank backdrop click / ESC / × closes it.
 */

const AUTO_SPEED = 0.55; // px/frame ≈ 33px/s
const DRAG_THRESHOLD = 3; // px — press becomes a drag beyond this
const CLICK_MAX_TRAVEL = 8; // px — beyond this a release is not a click
const FRICTION = 0.94; // velocity retention per frame (InertiaPlugin feel)
const THROW_MIN = 0.6; // px/frame — below this the throw settles into snap
const SNAP_EASE = 0.18; // per-frame approach to the snapped card edge

type EngineState = "auto" | "drag" | "throw" | "snap";

export function DesignGallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const stateRef = useRef<EngineState>("auto");
  const velocityRef = useRef(0);
  const snapPointsRef = useRef<number[]>([]);
  const dragRef = useRef<{
    pointerX: number;
    baseOffset: number;
    travel: number;
    lastX: number;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [pressed, setPressed] = useState(false);
  const [openWork, setOpenWork] = useState<DesignWork | null>(null);
  const lenis = useLenis();

  // Card-edge snap points (reference: cumulative loop times). Recomputed on
  // resize; snapping aligns a card's left edge with the track's padding.
  const measureSnapPoints = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const points: number[] = [];
    track.querySelectorAll<HTMLElement>(".design-strip__card").forEach((card) => {
      points.push(-(card.offsetLeft - pad));
    });
    snapPointsRef.current = points;
    // Debug/probe hook: lets the showcase check audit that the snap points
    // match the live card layout (the stale zero-width-measurement bug had
    // every release snapping to the first work).
    (window as unknown as Record<string, unknown>).__designSnapPoints =
      points;
  }, []);

  // Scroll engine: auto → drag → throw → snap → auto …
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame: number;

    const tick = () => {
      const half = track.scrollWidth / 2;
      if (half > 0) {
        const state = stateRef.current;
        if (state === "auto" && !reduced) {
          offsetRef.current -= AUTO_SPEED;
        } else if (state === "throw") {
          offsetRef.current += velocityRef.current;
          velocityRef.current *= FRICTION;
          if (Math.abs(velocityRef.current) < THROW_MIN) {
            stateRef.current = "snap";
          }
        } else if (state === "snap") {
          // Nearest card edge (reference getClosest over loop times).
          let nearest = offsetRef.current;
          let best = Infinity;
          for (const point of snapPointsRef.current) {
            for (const candidate of [point, point - half, point + half]) {
              const distance = Math.abs(candidate - offsetRef.current);
              if (distance < best) {
                best = distance;
                nearest = candidate;
              }
            }
          }
          offsetRef.current += (nearest - offsetRef.current) * SNAP_EASE;
          if (best < 0.6) {
            offsetRef.current = nearest;
            stateRef.current = "auto";
          }
        }
        // Seamless wrap in both directions, any magnitude (fast throws can
        // overshoot half by several laps). Modulo keeps the offset inside
        // (-half, 0]; the drag baseOffset is shifted by the same delta so
        // pointermove never re-derives a stale offset and snaps back.
        const wrapped = offsetRef.current % half;
        const normalized = wrapped > 0 ? wrapped - half : wrapped;
        const wrapDelta = normalized - offsetRef.current;
        if (wrapDelta !== 0) {
          offsetRef.current = normalized;
          if (dragRef.current) dragRef.current.baseOffset += wrapDelta;
        }
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
      frame = window.requestAnimationFrame(tick);
    };
    measureSnapPoints();
    window.addEventListener("resize", measureSnapPoints);
    // Covers are lazy-loaded and card widths come from the images — the
    // mount-time measurement sees collapsed cards (all snap points ≈ 0,
    // i.e. the first work), so every release snapped "home". Re-measure
    // once every asset has finished; per-image onLoad covers partial loads.
    window.addEventListener("load", measureSnapPoints);
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measureSnapPoints);
      window.removeEventListener("load", measureSnapPoints);
    };
  }, [measureSnapPoints]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.pointerType === "touch") return; // touch: native overflow scroll
    dragRef.current = {
      pointerX: event.clientX,
      baseOffset: offsetRef.current,
      travel: 0,
      lastX: event.clientX,
    };
    velocityRef.current = 0;
    setPressed(true); // reference: is-pressed on press, even a tap
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.pointerX;
    drag.travel = Math.max(drag.travel, Math.abs(dx));
    // Velocity in px/frame, lightly smoothed (reference: InertiaPlugin
    // "auto" velocity sampling).
    const instant = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    velocityRef.current = velocityRef.current * 0.75 + instant * 0.25;
    if (stateRef.current !== "drag") {
      if (drag.travel > DRAG_THRESHOLD) {
        stateRef.current = "drag";
        drag.baseOffset = offsetRef.current - dx; // jump-free handover
      } else {
        return; // still a tap: auto loop keeps running underneath
      }
    }
    offsetRef.current = drag.baseOffset + dx; // 1:1 tracking, no lerp
  };

  const endDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setPressed(false);
    if (stateRef.current === "drag") {
      // Reference snap(): <10px stays put, otherwise throw → snap.
      stateRef.current =
        Math.abs(velocityRef.current) >= THROW_MIN ? "throw" : "snap";
    }
    if (drag.travel > CLICK_MAX_TRAVEL) {
      suppressClickRef.current = true;
      // The click event fires right after pointerup — clear on the next tick.
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const openLightbox = useCallback((work: DesignWork) => {
    if (suppressClickRef.current) return; // it was a drag, not a click
    setOpenWork(work);
  }, []);

  const closeLightbox = useCallback(() => setOpenWork(null), []);

  // While the lightbox is open: stop Lenis so the page behind cannot
  // scroll, and let ESC close it. The overlay itself carries
  // data-lenis-prevent so ITS native wheel scrolling keeps working even
  // though Lenis swallows wheel events while stopped.
  useEffect(() => {
    if (!openWork) return;
    lenis?.stop();
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      lenis?.start();
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [openWork, lenis, closeLightbox]);

  const cards = [...designWorks, ...designWorks]; // seamless ×2 loop

  return (
    <div
      className="design-strip"
      data-pressed={pressed ? "true" : "false"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      data-action="查看图稿"
      data-cursor="project"
      role="list"
      aria-label="设计作品封面带，拖动浏览，点击查看全部图片"
    >
      <div className="design-strip__track" ref={trackRef}>
        {cards.map((work, cardIndex) => (
          <figure
            key={`${work.id}-${cardIndex}`}
            className="design-strip__card"
            role="listitem"
            onClick={() => openLightbox(work)}
          >
            <img
              src={work.cover}
              alt={work.title}
              loading="lazy"
              draggable={false}
              onLoad={measureSnapPoints}
            />
            {work.liveUrl && (
              <a
                className="design-strip__live"
                href={work.liveUrl}
                target="_blank"
                rel="noreferrer"
                data-cursor="interactive"
                aria-label={`前往体验 ${work.title}`}
                // Keep the strip's drag/lightbox handlers from seeing this
                // pointer at all — a tap here must navigate, never drag.
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                前往体验 ↗
              </a>
            )}
          </figure>
        ))}
      </div>

      {openWork &&
        createPortal(
          <div
            className="design-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={`${openWork.title}全部图稿`}
            data-lenis-prevent
            onClick={(event) => {
              if (event.target === event.currentTarget) closeLightbox();
            }}
          >
            <button
              type="button"
              className="design-lightbox__close"
              onClick={closeLightbox}
              aria-label="关闭图稿浮窗"
              data-cursor="interactive"
            >
              <X size={18} strokeWidth={2} />
            </button>
            {openWork.liveUrl && (
              <a
                className="design-lightbox__live"
                href={openWork.liveUrl}
                target="_blank"
                rel="noreferrer"
                data-cursor="interactive"
                aria-label={`前往体验 ${openWork.title}`}
              >
                前往体验 ↗
              </a>
            )}
            <div className="design-lightbox__panel">
              {openWork.items.map((item) =>
                item.type === "video" ? (
                  <video
                    key={item.src}
                    src={item.src}
                    controls
                    playsInline
                    preload="metadata"
                    className="design-lightbox__item"
                  />
                ) : (
                  <img
                    key={item.src}
                    src={item.src}
                    alt={`${openWork.title}图稿`}
                    loading="lazy"
                    className="design-lightbox__item"
                  />
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
