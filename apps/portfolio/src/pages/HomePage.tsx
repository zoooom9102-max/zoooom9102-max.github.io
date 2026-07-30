import { useRef } from "react";
import { ArrowDown } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useOutletContext } from "react-router-dom";
import { HeroMedia } from "../components/portfolio/HeroMedia";
import { HeroContentBackdrop } from "../components/transitions/HeroContentBackdrop";
import { TypewriterText } from "../components/ui/TypewriterText";
import { siteConfig } from "../data/site";
import { ContactPage } from "./ContactPage";
import { ProfilePage } from "./ProfilePage";
import { ProjectsPage } from "./ProjectsPage";
import { SkillsPage } from "./SkillsPage";
import { TimelinePage } from "./TimelinePage";

interface SiteOutletContext {
  heroActive: boolean;
  heroPausedByGate: boolean;
}

export function HomePage() {
  const { heroActive, heroPausedByGate } =
    useOutletContext<SiteOutletContext>();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });
  const heroContentY = useTransform(
    heroScrollProgress,
    [0, 1],
    ["0svh", "-150svh"],
  );
  const heroFooterY = useTransform(
    heroScrollProgress,
    [0, 1],
    ["0svh", "150svh"],
  );
  const heroFooterOpacity = useTransform(
    heroScrollProgress,
    [0, 0.5, 0.62],
    [1, 1, 0],
  );

  return (
    <>
      <section
        ref={heroRef}
        id="home"
        className="hero single-page-section"
      >
        <div className="hero__stage">
          <HeroMedia
            config={siteConfig.heroMedia}
            active={heroActive}
            paused={heroPausedByGate}
          />
          {heroActive && (
          <motion.div
            className="hero__content-scroll"
            style={{ y: heroContentY }}
          >
            <motion.div
              className="hero__content page-container"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <p className="hero__identity">
                <span>{siteConfig.name}</span>
                {siteConfig.nameEn}
              </p>
              <p className="hero__meta">
                CREATIVE · AIGC · CONTENT SYSTEMS
              </p>
              <h1>
                <TypewriterText text="WENZO LEE" start={0.1} duration={0.5} />
                <TypewriterText
                  text="CREATIVE"
                  className="outline"
                  start={0.6}
                  duration={0.75}
                />
                <TypewriterText
                  text="OS"
                  className="accent"
                  start={1.35}
                  duration={0.25}
                  persistCursor
                  persistCursorAt={3.5}
                />
              </h1>
              <div className="hero__positioning">
                <strong>
                  <TypewriterText
                    text="模型数据训练&测评"
                    start={1.6}
                    duration={0.75}
                  />
                </strong>
                <span>
                  <TypewriterText
                    text="MODEL DATA TRAINING & EVALUATION"
                    start={2.35}
                    duration={1.1}
                  />
                </span>
              </div>
              <motion.a
                className="hero__scroll"
                href="#portfolio"
                style={{
                  y: heroFooterY,
                  opacity: heroFooterOpacity,
                }}
              >
                Scroll to portfolio <ArrowDown size={18} />
              </motion.a>
            </motion.div>
          </motion.div>
          )}
        </div>
      </section>
      <div id="portfolio-surface" className="portfolio-surface">
        <HeroContentBackdrop
          heroId="home"
          surfaceId="portfolio-surface"
          endId="contact"
        />
        <ProfilePage />
        <TimelinePage />
        <SkillsPage />
        <ProjectsPage />
      </div>
      <ContactPage />
    </>
  );
}
