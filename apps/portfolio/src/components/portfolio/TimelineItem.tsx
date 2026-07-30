import { motion, useReducedMotion } from "motion/react";
import type { FocusEvent, PointerEvent } from "react";
import type { TimelineEntry } from "../../types/content";

interface TimelineItemProps {
  entry: TimelineEntry;
  index: number;
  isActive: boolean;
  onActiveChange: (isActive: boolean) => void;
}

export function TimelineItem({
  entry,
  index,
  isActive,
  onActiveChange,
}: TimelineItemProps) {
  const reduceMotion = useReducedMotion();

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      "--timeline-pointer-x",
      `${event.clientX - bounds.left}px`,
    );
    event.currentTarget.style.setProperty(
      "--timeline-pointer-y",
      `${event.clientY - bounds.top}px`,
    );
  };

  const activatePreview = () => {
    onActiveChange(true);
  };

  const deactivatePreview = () => {
    onActiveChange(false);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      deactivatePreview();
    }
  };

  return (
    <motion.article
      className={`timeline-item ${isActive ? "is-focused" : ""}`}
      data-cursor="interactive"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerEnter={activatePreview}
      onPointerLeave={deactivatePreview}
      onFocus={activatePreview}
      onBlur={handleBlur}
      initial={reduceMotion ? false : { opacity: 0, y: -18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.38 }}
      transition={{
        duration: 0.55,
        delay: reduceMotion ? 0 : index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <time>{entry.year}</time>
      <div className="timeline-item__content">
        <div className="timeline-item__heading">
          <div>
            <h2>{entry.title}</h2>
            <p className="timeline-item__subtitle">{entry.subtitle}</p>
          </div>
          <span className="timeline-item__tag">{entry.tag}</span>
        </div>
        <p className="timeline-item__description">{entry.description}</p>
        {entry.detail && (
          <p className="timeline-item__detail">{entry.detail}</p>
        )}
      </div>
    </motion.article>
  );
}
