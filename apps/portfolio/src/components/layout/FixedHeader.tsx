import { Menu, MessageCircle, Volume2, VolumeX, X } from "lucide-react";
import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { siteConfig } from "../../data/site";
import { MagneticLink } from "../ui/MagneticLink";

export function FixedHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const lenis = useLenis();

  useEffect(() => setIsOpen(false), [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/") return;

    const sections = siteConfig.navigation
      .map((item) => document.getElementById(item.path.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));

    // The observer is only a trigger. entries alone are unreliable here:
    // when the outgoing section leaves the band, its entry has
    // isIntersecting=false and very tall sections (projects is ~500vh)
    // never cross the 0.1 ratio threshold — so the active tab would stick
    // on "skills" forever. Recompute from layout instead: measure every
    // section's real pixel overlap with the same band (22%–42% of the
    // viewport height) and pick the winner.
    const observer = new IntersectionObserver(
      () => {
        const bandTop = window.innerHeight * 0.22;
        const bandBottom = window.innerHeight * 0.42;
        let bestId: string | null = null;
        let bestOverlap = 0;
        for (const section of sections) {
          const rect = section.getBoundingClientRect();
          const overlap =
            Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestId = section.id;
          }
        }
        if (bestId) setActiveSection(bestId);
      },
      {
        rootMargin: "-22% 0px -58% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [location.pathname]);

  const goToSection = (path: string) => {
    const sectionId = path.slice(1);
    setIsOpen(false);
    setActiveSection(sectionId);

    if (location.pathname !== "/") {
      navigate(`/${path}`);
      return;
    }

    if (sectionId === "home") {
      if (lenis) {
        lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } else if (sectionId === "contact") {
      const contactTop = document.documentElement.scrollHeight;
      if (lenis) {
        lenis.scrollTo(contactTop);
      } else {
        window.scrollTo({
          top: contactTop,
          behavior: "smooth",
        });
      }
    } else {
      const section = document.getElementById(sectionId);
      const heading = section?.querySelector<HTMLElement>(".section-heading");
      const isVideoStage = Boolean(section?.querySelector(".scroll-mapped-video"));
      const target = isVideoStage
        ? section
        : (heading ?? section);

      if (target) {
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
          lenis.scrollTo(targetTop);
        } else {
          window.scrollTo({ top: targetTop, behavior: "smooth" });
        }
      }
    }
    window.history.replaceState(null, "", path);
  };

  const toggleSound = () => {
    const nextValue = !soundEnabled;
    setSoundEnabled(nextValue);
    window.dispatchEvent(
      new CustomEvent("hero-sound-change", { detail: nextValue }),
    );
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="brand" aria-label="返回首页">
          <img
            className="brand__logo"
            src="/media/wenzo-logo.png"
            alt={`${siteConfig.monogram} Logo`}
          />
          <span className="brand__name">{siteConfig.name}</span>
          <span className="brand__version">{siteConfig.version}</span>
        </Link>

        <nav className="desktop-nav" aria-label="主导航">
          {siteConfig.navigation.map((item) => (
            <MagneticLink
              key={item.path}
              href={`/${item.path}`}
              maxOffset={3}
              strength={0.08}
              className={
                location.pathname === "/" &&
                activeSection === item.path.slice(1)
                  ? "is-active"
                  : ""
              }
              aria-current={
                location.pathname === "/" &&
                activeSection === item.path.slice(1)
                  ? "page"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();
                goToSection(item.path);
              }}
            >
              {item.labelEn}
            </MagneticLink>
          ))}
        </nav>

        <div className="site-header__actions">
          <button
            type="button"
            className={`sound-toggle ${soundEnabled ? "is-active" : ""}`}
            aria-label={soundEnabled ? "关闭背景视频声音" : "开启背景视频声音"}
            aria-pressed={soundEnabled}
            onClick={toggleSound}
          >
            {soundEnabled ? (
              <Volume2 size={15} aria-hidden="true" />
            ) : (
              <VolumeX size={15} aria-hidden="true" />
            )}
            <span>Sound {soundEnabled ? "On" : "Off"}</span>
          </button>
          <MagneticLink
            href="/#contact"
            className="header-contact"
            maxOffset={6}
            strength={0.1}
            onClick={(event) => {
              event.preventDefault();
              goToSection("#contact");
            }}
          >
            <MessageCircle size={16} aria-hidden="true" />
            Contact to Me
          </MagneticLink>
          <button
            type="button"
            className="menu-button"
            aria-label={isOpen ? "关闭菜单" : "打开菜单"}
            aria-expanded={isOpen}
            onClick={() => setIsOpen((value) => !value)}
          >
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <nav
        className={`mobile-nav ${isOpen ? "is-open" : ""}`}
        aria-label="移动端导航"
      >
        {siteConfig.navigation.map((item, index) => (
          <a
            key={item.path}
            href={`/${item.path}`}
            className={activeSection === item.path.slice(1) ? "is-active" : ""}
            onClick={(event) => {
              event.preventDefault();
              goToSection(item.path);
            }}
          >
            <span>0{index + 1}</span>
            <strong>{item.label}</strong>
            <em>{item.labelEn}</em>
          </a>
        ))}
      </nav>
    </header>
  );
}
