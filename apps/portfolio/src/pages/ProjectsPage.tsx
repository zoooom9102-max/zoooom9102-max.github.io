import {
  ArrowUpRight,
  Clapperboard,
  FileText,
  Images,
  Rss,
  Volume2,
  VolumeX,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { showcaseItems } from "../data/projects";
import type { ShowcaseItem } from "../data/projects";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { DesignGallery } from "../components/showcase/DesignGallery";

/** Workflow stages that light up in sequence on row hover (item 02). */
const PIPELINE_STAGES = ["抽帧", "理解", "预标注", "拆列", "批量"];

/** Row ordering by kind glyph on a vertical rail — no digits, so the rows
    never collide with the big section-heading numbers. */
const KIND_ICONS = {
  page: FileText,
  external: Workflow,
  video: Clapperboard,
  links: Rss,
  gallery: Images,
} as const;

const KIND_LABELS = {
  page: "PAGE",
  external: "REPO",
  video: "VIDEO",
  links: "LINKS",
  gallery: "GALLERY",
} as const;

export function ProjectsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const [chipText, setChipText] = useState("");
  // Inline preview sound: muted by default; the badge toggles it without
  // triggering the row's fullscreen click.
  const [previewMuted, setPreviewMuted] = useState(true);

  // Cursor-follow action chip: shows the row's verb ("全屏播放" …) and
  // trails the pointer with a light spring, award-site style.
  useEffect(() => {
    const list = listRef.current;
    const chip = chipRef.current;
    if (!list || !chip) return;

    let frame: number | null = null;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;

    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      chip.style.transform = `translate3d(${cx + 18}px, ${cy + 14}px, 0)`;
      if (Math.abs(x - cx) > 0.2 || Math.abs(y - cy) > 0.2) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = null;
      }
    };
    const kick = () => {
      if (frame === null) frame = window.requestAnimationFrame(tick);
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      kick();
    };
    const handleOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const row = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-action]",
      );
      const next = row?.dataset.action ?? "";
      setChipText((prev) => (prev === next ? prev : next));
    };
    const handleLeave = () => setChipText("");

    list.addEventListener("pointermove", handleMove, { passive: true });
    list.addEventListener("pointerover", handleOver, { passive: true });
    list.addEventListener("pointerleave", handleLeave);
    return () => {
      list.removeEventListener("pointermove", handleMove);
      list.removeEventListener("pointerover", handleOver);
      list.removeEventListener("pointerleave", handleLeave);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const chip = chipRef.current;
    if (chip) chip.dataset.visible = chipText ? "true" : "false";
    const label = chip?.querySelector("span");
    if (label && chipText) label.textContent = chipText;
  }, [chipText]);

  // Item 03: inline muted loop → click for fullscreen with sound; leaving
  // fullscreen restores the ambient preview state (and the badge toggle).
  useEffect(() => {
    const handleFullscreenChange = () => {
      const video = videoRef.current;
      if (!video || document.fullscreenElement) return;
      video.controls = false;
      video.muted = true;
      video.loop = true;
      setPreviewMuted(true);
      void video.play().catch(() => {});
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const enterFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.loop = false;
    video.controls = true;
    try {
      await video.requestFullscreen();
    } catch {
      // Fullscreen unavailable (iframe policy etc.) — still unmute inline.
    }
    await video.play().catch(() => {});
  };

  const togglePreviewSound = (event: React.MouseEvent) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted ? true : false;
    video.muted = next;
    setPreviewMuted(next);
    if (!next) void video.play().catch(() => {});
  };

  const renderMedia = (item: ShowcaseItem) => {
    if (item.kind === "video") {
      return (
        <div className="showcase__media showcase__media--video">
          <video
            ref={videoRef}
            src={item.video}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={`${item.title}预览`}
          />
          <button
            type="button"
            className="showcase__play-badge"
            data-sound={previewMuted ? "off" : "on"}
            onClick={togglePreviewSound}
            aria-label={previewMuted ? "打开预览声音" : "关闭预览声音"}
            aria-pressed={!previewMuted}
          >
            {previewMuted ? (
              <VolumeX size={13} strokeWidth={2.2} />
            ) : (
              <Volume2 size={13} strokeWidth={2.2} />
            )}
            {previewMuted ? "PREVIEW · 点击开声" : "PREVIEW · 有声播放中"}
          </button>
        </div>
      );
    }
    if (!item.image) return null;
    return (
      <div className="showcase__media">
        <img src={item.image} alt={item.imageAlt ?? ""} loading="lazy" />
        {item.kind === "external" && (
          <div className="showcase__pipe" aria-hidden="true">
            {PIPELINE_STAGES.map((stage) => (
              <span key={stage}>
                <i />
                {stage}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMeta = (item: ShowcaseItem, withAction = false) => {
    const KindIcon = KIND_ICONS[item.kind];
    return (
      <div className="showcase__meta">
        <span className="showcase__kind" aria-hidden="true">
          <KindIcon size={17} strokeWidth={1.8} />
          <em>{KIND_LABELS[item.kind]}</em>
        </span>
        <div className="showcase__text">
          <p className="showcase__tag">
            <i aria-hidden="true" />
            {item.tag} · {item.tagEn}
          </p>
          <h2>{item.title}</h2>
          <p className="showcase__en">{item.titleEn}</p>
          <p className="showcase__desc">{item.description}</p>
          {withAction && (
            <p className="showcase__action">
              <span>{item.action}</span>
              <ArrowUpRight size={14} strokeWidth={2.2} aria-hidden="true" />
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderRow = (item: ShowcaseItem, position: number) => {
    const body = (
      <>
        {renderMeta(item, true)}
        {renderMedia(item)}
      </>
    );

    if (item.kind === "page") {
      return (
        <Reveal key={item.id} delay={position * 0.07} distance={26}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className={`showcase__row showcase__row--${item.kind}`}
            data-action={item.action}
            data-cursor="project"
            aria-label={item.title}
          >
            {body}
          </a>
        </Reveal>
      );
    }
    if (item.kind === "external") {
      return (
        <Reveal key={item.id} delay={position * 0.07} distance={26}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className={`showcase__row showcase__row--${item.kind}`}
            data-action={item.action}
            data-cursor="project"
            aria-label={`${item.title}（打开 GitHub）`}
          >
            {body}
          </a>
        </Reveal>
      );
    }
    if (item.kind === "video") {
      return (
        <Reveal key={item.id} delay={position * 0.07} distance={26}>
          <div
            role="button"
            tabIndex={0}
            className="showcase__row showcase__row--video"
            data-action={item.action}
            data-cursor="project"
            aria-label={`${item.title}，点击全屏播放`}
            onClick={enterFullscreen}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void enterFullscreen();
              }
            }}
          >
            {renderMeta(item)}
            {renderMedia(item)}
          </div>
        </Reveal>
      );
    }
    if (item.kind === "gallery") {
      return (
        <Reveal key={item.id} delay={position * 0.07} distance={26}>
          <div className="showcase__row showcase__row--gallery">
            {renderMeta(item)}
            <DesignGallery />
          </div>
        </Reveal>
      );
    }
    return (
      <Reveal key={item.id} delay={position * 0.07} distance={26}>
        <div className="showcase__row showcase__row--links">
          {renderMeta(item)}
          <div className="showcase__plates">
            {item.links?.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="showcase__plate"
                data-action={item.action}
                data-cursor="project"
                aria-label={`前往${link.label}`}
              >
                <span className="showcase__plate-top">
                  <span>{link.labelEn}</span>
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <strong>{link.label}</strong>
                <span className="showcase__plate-note">{link.note}</span>
              </a>
            ))}
          </div>
        </div>
      </Reveal>
    );
  };

  return (
    <section
      id="projects"
      className="page-section page-container showcase single-page-section"
    >
      <Reveal>
        <SectionHeading
          index="05"
          label="PROJECTS"
          title="项目"
          accent="索引"
          description="评测方法、自动化工作流、视频创作与持续输出——四条正在生长的线。"
        />
      </Reveal>
      <div className="showcase__list" ref={listRef}>
        {showcaseItems.map((item, position) => renderRow(item, position))}
        <div
          ref={chipRef}
          className="showcase__cursor"
          data-visible="false"
          aria-hidden="true"
        >
          <span />
          <i>↗</i>
        </div>
      </div>
    </section>
  );
}
