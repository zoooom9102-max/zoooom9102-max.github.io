import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { LaunchParticleField } from "./LaunchParticleField";

interface LaunchGateProps {
  /** 0 for a fresh visit, 1 when returning upward from the hero. */
  initialProgress: number;
  preloadSources: Array<{
    src: string;
    type: string;
  }>;
  onLaunchStart: () => void;
  onHeroReveal: () => void;
  /** Fires when the hero becomes visible/hidden through the gate (tile
   *  conversion) — drives hero video pause for performance. */
  onHeroVisibilityChange: (visible: boolean) => void;
  onComplete: () => void;
}

interface TextBlock {
  position: "top" | "bottom" | "stage" | "center";
  lines: string[];
  english: string[];
  /** Main lines use the reference's per-char flicker reveal. */
  flicker?: boolean;
}

interface TextPage {
  blocks: TextBlock[];
  /** Reveal driven by load time instead of scroll (page 1). */
  timeBased?: boolean;
  /** Render at a slightly lower information level (pages 2-3). */
  secondary?: boolean;
}

// Three text pages on a continuous scroll axis (per the owner's revised
// flow). Pages travel like normal web content: scroll down and the
// current page rides UP off the screen while the next one rides IN from
// below — no fade masks. Page 1: main statement top-left + note
// bottom-right. Page 2 (reference shot 2 layout): one stage block.
// Page 3: the split-out third statement, same stage treatment.
const TEXT_PAGES: TextPage[] = [
  {
    blocks: [
      {
        position: "top",
        lines: ["我关注问题的本质，", "也相信行动带来答案。"],
        english: ["I look beneath the surface,", "then build toward an answer."],
        flicker: true,
      },
    ],
    timeBased: true,
  },
  {
    blocks: [
      {
        position: "stage",
        lines: ["探索新的可能，", "把它带入现实"],
        english: ["Explore what’s next. Make it real."],
        flicker: true,
      },
    ],
    secondary: true,
  },
  {
    blocks: [
      {
        position: "center",
        lines: ["先开始，再做成，再做好"],
        english: ["First do it. Then do it right. Then do it better."],
        flicker: true,
      },
    ],
    secondary: true,
  },
];

const GATE_NOTE =
  "我在设计、人工智能与技术实践之间持续探索。比起等待一个完美答案，我更愿意先让项目运行起来，再通过验证和迭代，让它逐渐变得更好。";
const GATE_NOTE_ENGLISH =
  "I keep exploring across design, AI and hands-on building. Rather than wait for a perfect answer, I get the project running first, then let testing and iteration make it better.";

// Wheel travel mapping: a full traversal ≈ 3.4 viewport heights of delta.
// The text pages ride the SAME axis: S = progress × 3.4 measured in
// screens, page i sits at S=i — one viewport of wheel flips one page,
// exactly like reading down a normal page.
const SCROLL_RANGE_RATIO = 3.4;
const HERO_REVEAL_AT = 0.72;
const COMPLETE_AT = 0.995;
// Tile-matrix scene handoff starts once the page-3 statement ("先开始…")
// has fully ridden up off the screen (S ≈ 2.55 at progress 0.75) and runs
// all the way to completion — a 0.245 scroll region (≈0.83 viewport of
// wheel, ~10–15 frames per act at a normal scroll cadence), giving the
// hero beneath time to mount and buffer before the gaps open.
const TILE_TRANSITION_START = 0.75;
// The hero shows through once the conversion act opens gaps (tileT > .5).
const TILE_COVERED_AT = 0.47;
const TILE_HERO_VISIBLE_AT = 0.5;
// When the gate remounts from the hero (progress 1), it eases back only
// to the END of the launch sequence — the tile-free point where page 3
// has just left the screen — so scrolling up from the hero lands on the
// gate's tail, not its opening.
const RETURN_REST_PROGRESS = TILE_TRANSITION_START;
// Reference tile hash (to-portfolio.com, verbatim): classic shader random
// fract(43758.5453 × sin(12.9898·x + 78.233·y)) → per-cell threshold.
const tileHash = (x: number, y: number) => {
  const h = 43758.5453 * Math.sin(12.9898 * x + 78.233 * y);
  return h - Math.floor(h);
};
// Reference hero timeline delay: text starts at 0.3s, particles converge
// AFTER the text (owner's sequence: background → text → monogram forms).
const REVEAL_DELAY_MS = 300;
const FORMATION_DELAY_MS = 1500;
// Page-1 reveal: line-gated cascade — line 1's chars flicker to completion
// (200ms each, 20ms stagger, reference keyframes [.4,.6,.8,1]) before line
// 2 starts. Mains use the SAME bare per-char flicker as the scrubbed
// pages (no whole-line grow/rise), auto-played on load time. The english
// captions float up the MOMENT the mains finish (owner: 大字渐显完紧接着
// 小字浮现); the bottom-right note then flickers char-by-char and its
// english caption follows immediately.
const LINE_STAGGER_MS = 120;
const CHAR_STAGGER_MS = 20;
const CHAR_DURATION_MS = 200;
const ENGLISH_LINE_STAGGER_MS = 80;
const ENGLISH_LINE_DURATION_MS = 320;
const NOTE_START_MS = 820;
const NOTE_CHAR_STAGGER_MS = 8;
const NOTE_CHAR_DURATION_MS = 160;
const NOTE_ENGLISH_DURATION_MS = 480;
const NOTE_ENGLISH_START_MS =
  NOTE_START_MS +
  [...GATE_NOTE].length * NOTE_CHAR_STAGGER_MS +
  NOTE_CHAR_DURATION_MS;
// Scrubbed pages (2-3): same line-gated rhythm in enterT space — a line's
// chars must finish before the next line starts, then the english lines
// tilt up out of their masks (reference: yPercent 320→0, rotate 10→0,
// power3.out — scaled into enterT units). The english window is short so
// the captions pop in right behind the mains instead of drifting late.
const ENTER_CHAR_STAGGER = 0.012;
const ENTER_CHAR_WINDOW = 0.16;
const ENTER_LINE_STAGGER = 0.08;
const ENTER_LINE_WINDOW = 0.2;
// Wheel scrub damping matched to the site-wide Lenis feel (SmoothScroll.tsx:
// lerp 0.075 ≈ 214ms time constant at 60fps, wheelMultiplier 0.82) so the
// gate's scroll carries the same inertial weight as the hero region.
const SCRUB_EASE_MS = 214;
const WHEEL_MULTIPLIER = 0.82;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

// Discrete flicker steps like the reference keyframes [.4, .6, .8, 1].
const flickerOpacity = (t: number) => {
  if (t <= 0) return 0;
  if (t < 0.33) return 0.4;
  if (t < 0.66) return 0.6;
  if (t < 1) return 0.8;
  return 1;
};

const preloadRequests = new Map<string, Promise<void>>();

const preloadMedia = (src: string) => {
  const existingRequest = preloadRequests.get(src);
  if (existingRequest) return existingRequest;

  const request = fetch(src, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Hero preload failed with ${response.status}`);
      }
      return response.blob();
    })
    .then(() => undefined)
    .catch(() => undefined);

  preloadRequests.set(src, request);
  return request;
};

// Flattened line registry: [page][block][line across main+english].
type LineRefMap = Array<
  Array<Array<HTMLSpanElement | null> | undefined> | undefined
>;
type CharRefMap = Array<
  Array<Array<Array<HTMLSpanElement | null> | undefined> | undefined> | undefined
>;

export function LaunchGate({
  initialProgress,
  preloadSources,
  onLaunchStart,
  onHeroReveal,
  onHeroVisibilityChange,
  onComplete,
}: LaunchGateProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRefs = useRef<LineRefMap>([]);
  const charRefs = useRef<CharRefMap>([]);
  const noteRef = useRef<HTMLParagraphElement | null>(null);
  const noteCharRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const noteEnglishRef = useRef<HTMLSpanElement | null>(null);
  const tilesRef = useRef<HTMLDivElement | null>(null);
  const tileCellsRef = useRef<Array<HTMLSpanElement>>([]);
  const progressRef = useRef(initialProgress);
  const targetRef = useRef(initialProgress);
  const reduceMotion = useReducedMotion();

  // Keep callbacks in refs so the director loop never re-subscribes.
  const callbacksRef = useRef({
    onLaunchStart,
    onHeroReveal,
    onHeroVisibilityChange,
    onComplete,
  });
  callbacksRef.current = {
    onLaunchStart,
    onHeroReveal,
    onHeroVisibilityChange,
    onComplete,
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    document.body.classList.add("is-launch-locked");

    let frame: number | null = null;
    let lastTime = 0;
    let touchY: number | null = null;
    let isDocumentVisible = !document.hidden;
    // Set only when THIS mount's forward run completes; the "completed"
    // milestone may legitimately start true on a remount and must not
    // block the director loop.
    let loopHalted = false;
    const mountedAt = performance.now();
    let revealDone = initialProgress > 0;
    let appliedKey = "";
    const milestones = {
      launched: initialProgress > 0.02,
      heroRevealed: initialProgress >= HERO_REVEAL_AT,
      heroSeeThrough: initialProgress > 0.99,
      // A remounted gate starts at progress 1 — treat it as already
      // completed so the director does not instantly unmount it again,
      // and re-arm once the user scrubs back below the dive threshold.
      completed: initialProgress >= COMPLETE_AT,
    };

    if (milestones.launched) callbacksRef.current.onLaunchStart();
    if (milestones.heroRevealed) callbacksRef.current.onHeroReveal();

    const applyProgress = (progress: number, now: number) => {
      // Scene handoff (reverse-engineered from to-portfolio.com's tile
      // grid, 14×9=126 cells) in TWO scroll-driven acts:
      //  · act 1 (tileT 0→0.45): tiles scale IN from 0.08 with a hashed
      //    per-cell stagger until they fully cover the gate (the "色块
      //    从小到大铺满全屏" beat);
      //  · act 2 (tileT 0.5→1): the tiles CONVERT to the next scene one
      //    by one — each cell fades out on its own hashed schedule, so
      //    more and more of the hero shows through as you scroll, until
      //    the whole screen has become the hero (the "mapPlaneReveal"
      //    beat — NOT a uniform whole-layer fade).
      // A pure function of progress — scrubs backwards seamlessly.
      const tileT = clamp01(
        (progress - TILE_TRANSITION_START) / (COMPLETE_AT - TILE_TRANSITION_START),
      );
      section.classList.toggle("launch-gate--covered", tileT > TILE_COVERED_AT);
      // The hero is visible only once the conversion act opens gaps;
      // outside that window the gate fully owns the screen and the hero
      // video should pause (no invisible decoding).
      const heroSeeThrough = tileT > TILE_HERO_VISIBLE_AT;
      if (heroSeeThrough !== milestones.heroSeeThrough) {
        milestones.heroSeeThrough = heroSeeThrough;
        callbacksRef.current.onHeroVisibilityChange(heroSeeThrough);
      }
      const tiles = tilesRef.current;
      if (tiles) {
        if (tileT < 0.001) {
          tiles.style.opacity = "0";
        } else {
          tiles.style.opacity = "1";
          const coverT = clamp01(tileT / 0.45);
          const convertT = clamp01((tileT - 0.5) / 0.5);
          const cells = tileCellsRef.current;
          for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
            const col = cellIndex % 14;
            const row = Math.floor(cellIndex / 14);
            const threshold = 0.26 * tileHash(col, row);
            const cellT = smoothstep(
              (coverT - threshold) /
                (Math.min(0.96, threshold + 0.52) - threshold),
            );
            // Convert schedule: swapped hash coords for an independent
            // pattern; each cell hands its patch of screen to the hero.
            const exitThreshold = 0.55 * tileHash(row, col);
            const cellOut = smoothstep(
              (convertT - exitThreshold) / 0.45,
            );
            cells[cellIndex].style.transform = `scale(${0.08 + 0.92 * cellT})`;
            cells[cellIndex].style.opacity = String(
              cellT > 0.02 ? 1 - cellOut : 0,
            );
          }
        }
      }

      const revealElapsed =
        initialProgress > 0
          ? Number.POSITIVE_INFINITY
          : now - mountedAt - REVEAL_DELAY_MS;
      revealDone =
        initialProgress > 0 ||
        revealElapsed > NOTE_ENGLISH_START_MS + NOTE_ENGLISH_DURATION_MS + 120;

      TEXT_PAGES.forEach((page, pageIndex) => {
        const pageElement = pageRefs.current[pageIndex];
        if (!pageElement) return;

        // Continuous scroll axis: page i rests at S=i and rides the wheel
        // like normal page content — scroll down and it travels UP off
        // screen while the next page rises from below. No fade masks.
        const scrollScreens = progress * SCROLL_RANGE_RATIO;
        const yScreens = pageIndex - scrollScreens;
        pageElement.style.transform = `translate3d(0, ${yScreens * window.innerHeight}px, 0)`;
        const onScreen = Math.abs(yScreens) < 1.2;
        pageElement.style.opacity = onScreen ? "1" : "0";
        pageElement.style.visibility = onScreen ? "visible" : "hidden";

        // Entrance progress: page 1 plays on load (after the reference's
        // 0.3s timeline delay); scrubbed pages start their reveal near the
        // bottom of the screen. The trigger line was the lower third
        // (block top ≈ 67vh); the owner's 23:52 beat moves it DOWN by ~1.5
        // main-glyph heights so the reveal starts earlier. The px→screen
        // conversion is exact: 1 scrollScreen = 100vh of ride (yScreens),
        // and the mains are font-size clamp(26px, 3.2vw, 48px).
        const mainFontPx = Math.min(
          48,
          Math.max(26, window.innerWidth * 0.032),
        );
        const enterStart =
          pageIndex - 1 + 0.65 - (1.5 * mainFontPx) / window.innerHeight;
        const enterT = page.timeBased
          ? revealElapsed > 0
            ? 1
            : 0
          : clamp01((scrollScreens - enterStart) / 0.5);

        page.blocks.forEach((block, blockIndex) => {
          const lineSet = lineRefs.current[pageIndex]?.[blockIndex] ?? [];
          const charSet = charRefs.current[pageIndex]?.[blockIndex] ?? [];
          const allLines = [...block.lines, ...block.english];
          const mainCount = block.lines.length;
          // Line-gated cascade (reference rhythm): a line's chars flicker
          // to completion before the next line starts; the english
          // captions follow the mains. lineBase accumulates each line's
          // full duration (ms for page 1, enterT units for scrubbed).
          let lineBase = 0;
          allLines.forEach((_, lineIndex) => {
            const lineElement = lineSet[lineIndex];
            if (!lineElement) return;
            const isMain = lineIndex < mainCount;
            const chars = charSet[lineIndex];
            const start = lineBase;

            if (page.timeBased && isMain) {
              // Page-1 mains: the SAME bare per-char flicker as the
              // scrubbed pages (the chars do the talking — no whole-line
              // grow/rise), auto-played on load time.
              lineElement.style.transform = "";
              lineElement.style.opacity = "1";
              lineBase =
                chars && chars.length > 0
                  ? start + chars.length * CHAR_STAGGER_MS + CHAR_DURATION_MS
                  : start + LINE_STAGGER_MS;
            } else if (page.timeBased) {
              // Page-1 english captions: a quick float-up the moment the
              // mains finish — no extra delay before the small text.
              const lineT = easeOutCubic(
                clamp01((revealElapsed - start) / ENGLISH_LINE_DURATION_MS),
              );
              lineElement.style.transform = `translate3d(0, ${(1 - lineT) * 18}px, 0)`;
              lineElement.style.opacity = String(lineT);
              lineBase = start + ENGLISH_LINE_STAGGER_MS;
            } else if (!isMain) {
              // Scrubbed english lines: tilt up out of the line mask
              // (reference: yPercent → 0, rotate 10→0, power3.out).
              const lineT = smoothstep((enterT - start) / ENTER_LINE_WINDOW);
              const yPercent = (1 - lineT) * 120;
              const rotate = (1 - lineT) * 10;
              lineElement.style.transform = `translate3d(0, ${yPercent}%, 0) rotate(${rotate}deg)`;
              lineElement.style.opacity = String(lineT);
              lineBase = start + ENTER_LINE_STAGGER;
            } else {
              // Scrubbed main lines: the chars do the talking.
              lineElement.style.transform = "";
              lineElement.style.opacity = "1";
              if (chars && chars.length > 0) {
                lineBase =
                  start + chars.length * ENTER_CHAR_STAGGER + ENTER_CHAR_WINDOW;
              }
            }

            if (chars && chars.length > 0) {
              for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
                const charElement = chars[charIndex];
                if (!charElement) continue;
                // Reference per-char flicker, gated by the line's own
                // window: page 1 cascades on load time, scrubbed pages
                // cascade in enterT space (reversible).
                const charT = page.timeBased
                  ? clamp01(
                      (revealElapsed - start - charIndex * CHAR_STAGGER_MS) /
                        CHAR_DURATION_MS,
                    )
                  : clamp01(
                      (enterT - start - charIndex * ENTER_CHAR_STAGGER) /
                        ENTER_CHAR_WINDOW,
                    );
                charElement.style.opacity = String(flickerOpacity(charT));
              }
            }
          });
        });
      });

      const note = noteRef.current;
      if (note) {
        // The note belongs to page 1: the container rides the same scroll
        // axis. The chinese note flickers in CHAR BY CHAR (same treatment
        // as the big statement, auto-played) once the mains have landed;
        // the english caption floats up immediately after the last char.
        const scrollY = -progress * SCROLL_RANGE_RATIO * window.innerHeight;
        note.style.opacity = "1";
        note.style.transform = `translate3d(0, ${scrollY}px, 0)`;
        note.style.visibility =
          revealElapsed > NOTE_START_MS ? "visible" : "hidden";
        const noteChars = noteCharRefs.current;
        for (
          let charIndex = 0;
          charIndex < noteChars.length;
          charIndex += 1
        ) {
          const charElement = noteChars[charIndex];
          if (!charElement) continue;
          const charT = clamp01(
            (revealElapsed -
              NOTE_START_MS -
              charIndex * NOTE_CHAR_STAGGER_MS) /
              NOTE_CHAR_DURATION_MS,
          );
          charElement.style.opacity = String(flickerOpacity(charT));
        }
        const noteEnT = easeOutCubic(
          clamp01(
            (revealElapsed - NOTE_ENGLISH_START_MS) / NOTE_ENGLISH_DURATION_MS,
          ),
        );
        const noteEnglish = noteEnglishRef.current;
        if (noteEnglish) {
          noteEnglish.style.opacity = String(noteEnT);
          noteEnglish.style.transform = `translate3d(0, ${(1 - noteEnT) * 16}px, 0)`;
        }
      }
    };

    const tick = (time: number) => {
      frame = null;
      if (!isDocumentVisible) return;
      const delta = lastTime ? Math.min(50, time - lastTime) : 16.667;
      lastTime = time;

      // Buttery scrub: eased chase of the wheel target (Lenis-weighted,
      // same damping as the hero region — see SCRUB_EASE_MS).
      const ease = reduceMotion ? 1 : 1 - Math.exp(-delta / SCRUB_EASE_MS);
      const previous = progressRef.current;
      const next =
        previous + (targetRef.current - previous) * Math.min(1, ease);
      progressRef.current = Math.abs(next - targetRef.current) < 0.0004
        ? targetRef.current
        : next;

      // Cheap change key so idle frames skip DOM writes entirely.
      const changeKey = `${progressRef.current.toFixed(4)}|${revealDone ? 1 : Math.floor(time - mountedAt)}`;
      if (changeKey !== appliedKey) {
        appliedKey = changeKey;
        applyProgress(progressRef.current, time);
      }

      if (!milestones.launched && progressRef.current > 0.02) {
        milestones.launched = true;
        callbacksRef.current.onLaunchStart();
      }
      if (!milestones.heroRevealed && progressRef.current >= HERO_REVEAL_AT) {
        milestones.heroRevealed = true;
        callbacksRef.current.onHeroReveal();
      }
      if (milestones.completed && progressRef.current <= TILE_TRANSITION_START) {
        // Re-arm for the next forward run. `<=` because the hero-return
        // rest point IS TILE_TRANSITION_START: without it the gate would
        // land on its tail with completion still latched and ignore the
        // next downward scroll.
        milestones.completed = false;
      }
      if (!milestones.completed && progressRef.current >= COMPLETE_AT) {
        milestones.completed = true;
        loopHalted = true;
        callbacksRef.current.onComplete();
        return;
      }

      // Park the loop when idle; wheel/touch/visibility restart it.
      const settled =
        revealDone && progressRef.current === targetRef.current;
      if (!settled) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const ensureLoop = () => {
      if (frame === null && isDocumentVisible && !loopHalted) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const scrollBy = (delta: number) => {
      const range =
        Math.max(window.innerHeight, 1) * SCROLL_RANGE_RATIO;
      targetRef.current = clamp01(targetRef.current + delta / range);
      lastTime = 0;
      ensureLoop();
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? window.innerHeight : 1;
      scrollBy(event.deltaY * unit * WHEEL_MULTIPLIER);
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = (event: TouchEvent) => {
      if (touchY === null) return;
      event.preventDefault();
      const nextY = event.touches[0]?.clientY ?? touchY;
      scrollBy((touchY - nextY) * 2.2);
      touchY = nextY;
    };
    const handleTouchEnd = () => {
      touchY = null;
    };

    const handleVisibility = () => {
      isDocumentVisible = !document.hidden;
      if (!isDocumentVisible && frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      } else {
        lastTime = 0;
        ensureLoop();
      }
    };

    // Returning from the hero: start fully dived (progress 1) and ease back
    // to the resting point so the gate visibly re-materializes.
    if (initialProgress > 0.99) {
      targetRef.current = RETURN_REST_PROGRESS;
    }

    // Cache the 126 tile cells once — the per-frame writer must not
    // re-query the DOM.
    tileCellsRef.current = tilesRef.current
      ? Array.from(tilesRef.current.querySelectorAll("span"))
      : [];

    applyProgress(progressRef.current, performance.now());
    ensureLoop();
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.body.classList.remove("is-launch-locked");
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reduceMotion, initialProgress]);

  // Warm the hero media while the user plays with the gate.
  useEffect(() => {
    const reduceMotionEnabled = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const saveData = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection?.saveData;
    if (reduceMotionEnabled || saveData) return;

    const uniqueSources = [...new Set(preloadSources.map(({ src }) => src))];
    const startPreload = () => {
      for (const src of uniqueSources) {
        void preloadMedia(src);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(startPreload, {
        timeout: 900,
      });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = globalThis.setTimeout(startPreload, 180);
    return () => globalThis.clearTimeout(timer);
  }, [preloadSources]);

  const setLineRef = (
    pageIndex: number,
    blockIndex: number,
    lineIndex: number,
    element: HTMLSpanElement | null,
  ) => {
    const page = (lineRefs.current[pageIndex] ??= []);
    const block = (page[blockIndex] ??= []);
    block[lineIndex] = element;
  };

  const setCharRef = (
    pageIndex: number,
    blockIndex: number,
    lineIndex: number,
    charIndex: number,
    element: HTMLSpanElement | null,
  ) => {
    const page = (charRefs.current[pageIndex] ??= []);
    const block = (page[blockIndex] ??= []);
    const line = (block[lineIndex] ??= []);
    line[charIndex] = element;
  };

  return (
    <section
      ref={sectionRef}
      // A hero-return remount starts fully covered: the class must be
      // present on the VERY FIRST PAINT (the effect's applyProgress runs
      // after paint), otherwise one dark frame flashes before the hero
      // shows through — the "黑幕" the owner saw.
      className={
        initialProgress > 0.99
          ? "launch-gate launch-gate--covered"
          : "launch-gate"
      }
      aria-label="网站启动界面"
    >
      <LaunchParticleField
        progressRef={progressRef}
        introDone={initialProgress > 0}
        formationDelayMs={FORMATION_DELAY_MS}
      />
      <div className="launch-gate__grid" aria-hidden="true" />

      <header className="launch-gate__header" aria-hidden="true">
        <span>李文政 / PORTFOLIO SYSTEM</span>
        <span>MODEL DATA TRAINING & EVALUATION</span>
      </header>

      {TEXT_PAGES.map((page, pageIndex) => (
        <div
          key={page.blocks[0].lines[0]}
          ref={(element) => {
            pageRefs.current[pageIndex] = element;
          }}
          className="launch-gate__page"
          aria-hidden="true"
        >
          {page.blocks.map((block, blockIndex) => (
            <div
              key={block.lines[0]}
              className={`launch-gate__phrase-half launch-gate__phrase-half--${block.position}${
                page.secondary ? " launch-gate__phrase-half--secondary" : ""
              }`}
            >
              {[
                ...block.lines.map((text) => ({ text, main: true })),
                ...block.english.map((text) => ({ text, main: false })),
              ].map((entry, lineIndex) => (
                <span className="launch-gate__line-mask" key={entry.text}>
                  <span
                    className={`launch-gate__line ${
                      entry.main
                        ? "launch-gate__line--main"
                        : "launch-gate__line--english"
                    }`}
                    ref={(element) => {
                      setLineRef(pageIndex, blockIndex, lineIndex, element);
                    }}
                  >
                    {entry.main && block.flicker ? (
                      [...entry.text].map((char, charIndex) => (
                        <span
                          className="launch-gate__char"
                          key={`${char}-${charIndex}`}
                          ref={(element) => {
                            setCharRef(
                              pageIndex,
                              blockIndex,
                              lineIndex,
                              charIndex,
                              element,
                            );
                          }}
                        >
                          {char}
                        </span>
                      ))
                    ) : entry.main ? (
                      entry.text
                    ) : (
                      <em>{entry.text}</em>
                    )}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}

      <p ref={noteRef} className="launch-gate__note" aria-hidden="true">
        <span className="launch-gate__note-main">
          {[...GATE_NOTE].map((char, charIndex) => (
            <span
              className="launch-gate__note-char"
              key={`${char}-${charIndex}`}
              style={{ opacity: 0 }}
              ref={(element) => {
                noteCharRefs.current[charIndex] = element;
              }}
            >
              {char}
            </span>
          ))}
        </span>
        <span ref={noteEnglishRef} className="launch-gate__note-english">
          {GATE_NOTE_ENGLISH}
        </span>
      </p>

      <footer className="launch-gate__footer">
        <span>DESIGN · DATA · INTELLIGENCE</span>
        <span>SELECTED WORKS · 2024—2026</span>
      </footer>

      <div ref={tilesRef} className="launch-gate__tiles" aria-hidden="true">
        {Array.from({ length: 126 }, (_, tileIndex) => (
          <span key={tileIndex} className="launch-gate__tile" />
        ))}
      </div>
    </section>
  );
}
