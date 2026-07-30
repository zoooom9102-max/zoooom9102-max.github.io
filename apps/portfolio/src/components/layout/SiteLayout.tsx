import { useCallback, useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { PointerHalo } from "../effects/PointerHalo";
import { LaunchGate } from "../launch/LaunchGate";
import { siteConfig } from "../../data/site";
import { FooterStatusBar } from "./FooterStatusBar";
import { FixedHeader } from "./FixedHeader";

export function SiteLayout() {
  const location = useLocation();
  const lenis = useLenis();
  // The gate is a scroll-scrubbed overlay: it mounts on top of the site and
  // unmounts when its progress reaches 1. Scrolling up at the top of the
  // home page re-mounts it at progress 1 so the sequence can be replayed
  // backward. It belongs to the HOME route only — deep links (e.g.
  // /projects/eval-method) must land directly on their content.
  const [gateMounted, setGateMounted] = useState(
    () => location.pathname === "/",
  );
  const [gateInitialProgress, setGateInitialProgress] = useState(0);
  const [gateStarted, setGateStarted] = useState(false);
  const [heroActive, setHeroActive] = useState(false);
  // The gate reports when the hero is actually visible through the tile
  // conversion; while the gate owns the screen and the hero is NOT
  // visible, the hero video pauses (perf: no invisible decoding).
  const [heroSeeThrough, setHeroSeeThrough] = useState(false);
  const [siteLive, setSiteLive] = useState(() => location.pathname !== "/");
  const siteExperienceRef = useRef<HTMLDivElement>(null);
  const liveAtRef = useRef(0);
  const shouldMountExperience = siteLive || gateStarted;

  // Swallow leftover wheel deltas for a beat after the gate hands control
  // to the site, so the final scroll gesture does not slingshot the hero.
  useEffect(() => {
    const swallow = (event: WheelEvent) => {
      if (
        liveAtRef.current > 0 &&
        performance.now() - liveAtRef.current < 700
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("wheel", swallow, {
      capture: true,
      passive: false,
    });
    return () =>
      window.removeEventListener("wheel", swallow, { capture: true });
  }, []);

  useEffect(() => {
    siteExperienceRef.current?.toggleAttribute("inert", !siteLive);
  }, [siteLive, shouldMountExperience]);

  useEffect(() => {
    if (!lenis) return;

    if (siteLive) {
      lenis.start();
    } else {
      lenis.stop();
    }
  }, [siteLive, lenis]);

  const handleComplete = useCallback(() => {
    liveAtRef.current = performance.now();
    setSiteLive(true);
    setGateMounted(false);
    window.scrollTo({ top: 0, behavior: "auto" });
    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true });
    }
  }, [lenis]);

  // Re-entering the gate: wheel up while parked near the very top of home.
  // Lenis glides to the top asynchronously, so we also re-mount when the
  // scroll settles at 0 shortly after an upward wheel gesture.
  useEffect(() => {
    if (!siteLive || location.pathname !== "/") return;

    let lastWheelUpAt = 0;

    const remountGate = () => {
      if (lenis) {
        lenis.stop();
        lenis.scrollTo(0, { immediate: true, force: true });
      }
      window.scrollTo({ top: 0, behavior: "auto" });
      setGateInitialProgress(1);
      setGateMounted(true);
      setSiteLive(false);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY >= 0) return;
      lastWheelUpAt = performance.now();
      if (window.scrollY > 48) return;

      event.preventDefault();
      remountGate();
    };

    const handleScrollSettle = () => {
      if (!lastWheelUpAt) return;
      if (performance.now() - lastWheelUpAt > 1600) return;
      if (window.scrollY > 2) return;
      remountGate();
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleScrollSettle, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScrollSettle);
    };
  }, [siteLive, lenis, location.pathname]);

  useEffect(() => {
    if (!siteLive) return;
    if (location.pathname !== "/") return;

    const sectionId = location.hash.replace("#", "") || "home";
    requestAnimationFrame(() => {
      if (sectionId === "home") {
        if (lenis) {
          lenis.scrollTo(0, {
            immediate: !location.hash,
            force: true,
          });
        } else {
          window.scrollTo({
            top: 0,
            behavior: location.hash ? "smooth" : "auto",
          });
        }
        return;
      }

      if (sectionId === "contact") {
        const contactTop = document.documentElement.scrollHeight;
        if (lenis) {
          lenis.scrollTo(contactTop, {
            immediate: !location.hash,
            force: true,
          });
        } else {
          window.scrollTo({
            top: contactTop,
            behavior: location.hash ? "smooth" : "auto",
          });
        }
        return;
      }

      const section = document.getElementById(sectionId);
      const heading = section?.querySelector<HTMLElement>(".section-heading");
      const isVideoStage = Boolean(section?.querySelector(".scroll-mapped-video"));
      const target = isVideoStage
        ? section
        : (heading ?? section);
      if (!target) return;

      const headerHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--header-height",
        ),
      );
      const targetTop = isVideoStage
        ? section!.offsetTop - headerHeight
        : window.scrollY +
          target.getBoundingClientRect().top -
          headerHeight -
          36;
      if (lenis) {
        lenis.scrollTo(targetTop, {
          immediate: !location.hash,
          force: true,
        });
      } else {
        window.scrollTo({
          top: targetTop,
          behavior: location.hash ? "smooth" : "auto",
        });
      }
    });
  }, [siteLive, lenis, location.pathname, location.hash]);

  return (
    <div className="site-shell">
      {gateMounted && (
        <LaunchGate
          initialProgress={gateInitialProgress}
          preloadSources={[
            ...siteConfig.heroMedia.desktopSources,
            ...siteConfig.heroMedia.mobileSources,
          ]}
          onLaunchStart={() => setGateStarted(true)}
          onHeroReveal={() => setHeroActive(true)}
          onHeroVisibilityChange={setHeroSeeThrough}
          onComplete={handleComplete}
        />
      )}
      {shouldMountExperience && (
        <div
          ref={siteExperienceRef}
          className="site-experience"
          aria-hidden={!siteLive}
        >
          <a href="#main-content" className="skip-link">
            跳到主要内容
          </a>
          <FixedHeader />
          <aside className="side-signature" aria-hidden="true">
            THINKING WITH HEART, BUILDING WITH AI
          </aside>
          <main id="main-content">
            <Outlet
              context={{
                heroActive,
                heroPausedByGate: gateMounted && !heroSeeThrough,
              }}
            />
          </main>
          <PointerHalo />
          <FooterStatusBar />
        </div>
      )}
    </div>
  );
}
