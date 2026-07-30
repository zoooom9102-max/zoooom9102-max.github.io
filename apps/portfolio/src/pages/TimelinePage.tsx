import { useEffect, useRef, useState } from "react";
import { TimelineItem } from "../components/portfolio/TimelineItem";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { timeline } from "../data/timeline";
import { useSceneActivity } from "../hooks/useSceneActivity";

const orderedTimeline = [...timeline].sort((first, second) => {
  const firstYear = Number.parseInt(first.year.slice(0, 4), 10);
  const secondYear = Number.parseInt(second.year.slice(0, 4), 10);
  return secondYear - firstYear;
});

export function TimelinePage() {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { ref: sectionRef, isActive } = useSceneActivity<HTMLElement>({
    rootMargin: "20% 0px",
  });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    if (activeIndex !== null) {
      list.style.setProperty(
        "--timeline-progress",
        String((activeIndex + 0.5) / orderedTimeline.length),
      );
      return;
    }

    list.style.setProperty(
      "--timeline-progress",
      String(scrollProgressRef.current),
    );
  }, [activeIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !isActive) return;

    let frame: number | null = null;
    const updateProgress = () => {
      frame = null;
      const bounds = list.getBoundingClientRect();
      const readingLine = window.innerHeight * 0.58;
      const progress = Math.min(
        1,
        Math.max(0, (readingLine - bounds.top) / Math.max(bounds.height, 1)),
      );
      scrollProgressRef.current = progress;
      if (activeIndex === null) {
        list.style.setProperty("--timeline-progress", String(progress));
      }
    };
    const requestProgressUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
    return () => {
      window.removeEventListener("scroll", requestProgressUpdate);
      window.removeEventListener("resize", requestProgressUpdate);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeIndex, isActive]);

  return (
    <section
      ref={sectionRef}
      id="timeline"
      className={`page-section page-container timeline-page single-page-section ${
        isActive ? "is-scene-active" : ""
      }`}
    >
      <Reveal>
        <SectionHeading
          index="03"
          label="TIMELINE"
          title="JOURNEY"
          accent="履历"
          description="一条从设计走向大模型训练与 AI 产品搭建的路径"
        />
      </Reveal>
      <div
        ref={listRef}
        className="timeline-list"
        data-order="newest-to-oldest"
      >
        <span className="timeline-list__progress" aria-hidden="true" />
        {orderedTimeline.map((entry, index) => (
          <TimelineItem
            key={`${entry.year}-${entry.title}`}
            entry={entry}
            index={index}
            isActive={activeIndex === index}
            onActiveChange={(isItemActive) =>
              setActiveIndex(isItemActive ? index : null)
            }
          />
        ))}
      </div>
    </section>
  );
}
