"use client";

import {
  ArrowDown,
  AudioWaveform,
  Box,
  Captions,
  Check,
  ChevronRight,
  Eye,
  Film,
  Image as ImageIcon,
  Layers3,
  MousePointer2,
  ScanLine,
  Sparkles,
  Tag,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  aestheticCases,
  annotationSchema,
  conclusions,
  evaluationCases,
  frameworks,
  navItems,
  productCases,
  uiCases,
  visualMethods,
} from "./data/content";

const assetUrl = (path: string) =>
  path.startsWith("/media/") ? `${import.meta.env.BASE_URL}${path.slice(1)}` : path;

const aestheticCategories = ["镜头语言", "构图空间", "焦段景深", "光影效果", "色彩影调", "风格表现", "媒介质感"] as const;
type AestheticCategory = (typeof aestheticCategories)[number];
type AestheticCase = (typeof aestheticCases)[number];

function AestheticMedia({ item, detail = false }: { item: AestheticCase; detail?: boolean }) {
  const className = detail ? "detail-image" : "aesthetic-image";
  const alt = `${item.title}${detail ? "完整案例" : "案例"}`;
  const secondaryMedia = "secondaryMedia" in item ? item.secondaryMedia : undefined;

  return (
    <div className={className}>
      {item.mediaType === "video" ? (
          <video aria-label={alt} src={assetUrl(item.media)} controls muted playsInline preload="metadata" />
        ) : secondaryMedia ? (
          <div className="aesthetic-media-pair">
            <img alt={`${alt}：高调光`} src={assetUrl(item.media)} loading={detail ? undefined : "lazy"} />
            <img alt={`${alt}：低调光`} src={assetUrl(secondaryMedia)} loading={detail ? undefined : "lazy"} />
          </div>
        ) : (
          <img alt={alt} src={assetUrl(item.media)} loading={detail ? undefined : "lazy"} />
      )}
      <span className="media-category">{item.category}</span>
    </div>
  );
}

function TagRow({ tags }: { tags: readonly string[] }) {
  return <div className="tag-row">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

function SectionHeading({
  index,
  label,
  title,
  description,
  light = false,
}: {
  index: string;
  label: string;
  title: string;
  description: string;
  light?: boolean;
}) {
  return (
    <div className={`section-heading split-heading ${light ? "light-heading" : ""}`}>
      <div>
        <p className="eyebrow">{index} · {label}</p>
        <h2>{title}</h2>
      </div>
      <p>{description}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  max,
  color,
  secondary,
  valueLabel,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  secondary?: { value: number; label: string };
  valueLabel?: string;
}) {
  return (
    <div className="metric-row">
      <div className="metric-label"><strong>{label}</strong><span>{valueLabel ?? value.toFixed(value < 6 ? 2 : 0)}</span></div>
      <div className="metric-track" aria-label={`${label} ${value}`}>
        <i style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
        {secondary && <b style={{ left: `${Math.min(100, (secondary.value / max) * 100)}%` }} title={`${secondary.label} ${secondary.value}`} />}
      </div>
      {secondary && <small>{secondary.label} {secondary.value.toFixed(2)}</small>}
    </div>
  );
}

function RadarChart({
  radar,
  visibleModels,
  focusedModel,
  setFocusedModel,
}: {
  radar: (typeof conclusions.t2v.radars)[number];
  visibleModels: ReadonlySet<string>;
  focusedModel: string | null;
  setFocusedModel: (model: string | null) => void;
}) {
  const centerX = 210;
  const centerY = 164;
  const radius = 112;
  const pointAt = (axis: number, value: number) => {
    const angle = -Math.PI / 2 + axis * (Math.PI * 2 / radar.axes.length);
    const scaled = radius * (value / 5);
    return [centerX + Math.cos(angle) * scaled, centerY + Math.sin(angle) * scaled] as const;
  };
  const polygon = (values: readonly number[]) => values.map((value, axis) => pointAt(axis, value).join(",")).join(" ");

  return (
    <article className="radar-card">
      <div className="radar-card-head"><div><span>{radar.id === "common" ? "COMMON" : "SPECIAL"}</span><h4>{radar.title}</h4></div><p>{radar.caption}</p></div>
      <svg className="radar-chart" viewBox="0 0 420 340" role="img" aria-label={`${radar.title}模型对比图`}>
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon className="radar-grid-line" key={level} points={polygon(radar.axes.map(() => level))} />
        ))}
        {radar.axes.map((axis, index) => {
          const [x, y] = pointAt(index, 5);
          const [labelX, labelY] = pointAt(index, 6.15);
          const anchor = labelX < centerX - 8 ? "end" : labelX > centerX + 8 ? "start" : "middle";
          return (
            <g key={axis}>
              <line className="radar-axis" x1={centerX} y1={centerY} x2={x} y2={y} />
              <text className="radar-label" x={labelX} y={labelY} textAnchor={anchor} dominantBaseline="middle">{axis}</text>
            </g>
          );
        })}
        {radar.series.filter((item) => visibleModels.has(item.name)).map((item) => {
          const muted = focusedModel !== null && focusedModel !== item.name;
          return (
            <g
              className={`radar-series ${muted ? "muted" : ""}`}
              key={item.name}
              onMouseEnter={() => setFocusedModel(item.name)}
              onMouseLeave={() => setFocusedModel(null)}
            >
              <polygon points={polygon(item.values)} style={{ color: item.color }} />
              {item.values.map((value, axis) => {
                const [x, y] = pointAt(axis, value);
                return <circle key={`${item.name}-${axis}`} cx={x} cy={y} r="3" style={{ color: item.color }} />;
              })}
            </g>
          );
        })}
      </svg>
    </article>
  );
}

function CaseCopy({ item }: { item: (typeof evaluationCases)[number] }) {
  return (
    <div className="case-copy">
      <div className="case-copy-title">
        <div><span>{item.model}</span><h4>{item.title}</h4></div>
        <strong>{item.score}</strong>
      </div>
      <TagRow tags={item.tags} />
      <div className="case-text-line"><span>PROMPT</span><p>{item.prompt}</p></div>
      <div className="case-text-line conclusion-line"><span>结论</span><p>{item.conclusion}</p></div>
    </div>
  );
}

function VisualCaseRail({
  items,
  type,
}: {
  items: typeof productCases | typeof uiCases;
  type: "product" | "ui";
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const inertiaFrameRef = useRef<number | null>(null);
  const dragRef = useRef({ active: false, pointerId: -1, lastX: 0, lastTime: 0, velocity: 0 });
  const progressDragRef = useRef({ active: false, pointerId: -1, grabOffset: 0 });
  const label = type === "product" ? "产品设计标注案例" : "交互界面标注案例";
  const railId = `visual-${type}-rail`;

  const stopInertia = () => {
    if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current);
    inertiaFrameRef.current = null;
  };

  const startInertia = (initialVelocity: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(initialVelocity) < 0.02) return;
    stopInertia();
    const rail = railRef.current;
    if (!rail) return;
    let velocity = Math.max(-3.2, Math.min(3.2, initialVelocity));
    let previousTime = window.performance.now();
    const animate = (time: number) => {
      const deltaTime = Math.min(32, time - previousTime);
      previousTime = time;
      const previousScroll = rail.scrollLeft;
      rail.scrollLeft += velocity * deltaTime;
      velocity *= Math.pow(0.94, deltaTime / 16);
      const reachedBoundary = rail.scrollLeft === previousScroll;
      if (Math.abs(velocity) < 0.015 || reachedBoundary) {
        inertiaFrameRef.current = null;
        return;
      }
      inertiaFrameRef.current = window.requestAnimationFrame(animate);
    };
    inertiaFrameRef.current = window.requestAnimationFrame(animate);
  };

  const finishDrag = (withInertia = true) => {
    if (!dragRef.current.active) return;
    const velocity = dragRef.current.velocity;
    dragRef.current.active = false;
    railRef.current?.classList.remove("is-dragging");
    if (withInertia) startInertia(velocity);
  };

  const scrollFromProgress = (clientX: number, grabOffset: number) => {
    const rail = railRef.current;
    const track = progressRef.current;
    if (!rail || !track) return;
    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (maxScroll <= 0) return;
    const trackRect = track.getBoundingClientRect();
    const thumbWidth = Math.max(32, trackRect.width * (rail.clientWidth / rail.scrollWidth));
    const travel = trackRect.width - thumbWidth;
    const thumbLeft = Math.max(0, Math.min(travel, clientX - trackRect.left - grabOffset));
    rail.scrollLeft = (thumbLeft / travel) * maxScroll;
  };

  useEffect(() => {
    const rail = railRef.current;
    const track = progressRef.current;
    if (!rail || !track) return;
    const updateProgress = () => {
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      const visibleRatio = Math.min(1, rail.clientWidth / rail.scrollWidth);
      const thumbSize = Math.max(8, visibleRatio * 100);
      const thumbStart = maxScroll > 0 ? (rail.scrollLeft / maxScroll) * (100 - thumbSize) : 0;
      track.style.setProperty("--progress-size", `${thumbSize}%`);
      track.style.setProperty("--progress-start", `${thumbStart}%`);
      track.setAttribute("aria-valuenow", `${maxScroll > 0 ? Math.round((rail.scrollLeft / maxScroll) * 100) : 0}`);
    };
    const resizeObserver = new ResizeObserver(updateProgress);
    resizeObserver.observe(rail);
    rail.addEventListener("scroll", updateProgress, { passive: true });
    updateProgress();
    return () => {
      resizeObserver.disconnect();
      rail.removeEventListener("scroll", updateProgress);
      if (inertiaFrameRef.current !== null) window.cancelAnimationFrame(inertiaFrameRef.current);
    };
  }, []);

  return (
    <div className="visual-rail-shell">
      <div className="visual-rail-meta"><span>按住并横向拖动浏览</span><span>{items.length} CASES · 2 ROWS</span></div>
      <div
        aria-controls={railId}
        aria-label={`${label}浏览进度`}
        aria-orientation="horizontal"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={0}
        className="visual-progress"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          stopInertia();
          railRef.current?.scrollBy({ left: event.key === "ArrowLeft" ? -240 : 240, behavior: "smooth" });
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const track = progressRef.current;
          const thumb = track?.querySelector<HTMLElement>(".visual-progress-thumb");
          if (!track || !thumb) return;
          stopInertia();
          const thumbRect = thumb.getBoundingClientRect();
          const isThumb = (event.target as HTMLElement).closest(".visual-progress-thumb") !== null;
          const grabOffset = isThumb ? event.clientX - thumbRect.left : thumbRect.width / 2;
          progressDragRef.current = { active: true, pointerId: event.pointerId, grabOffset };
          track.setPointerCapture(event.pointerId);
          track.classList.add("is-dragging");
          scrollFromProgress(event.clientX, grabOffset);
        }}
        onPointerMove={(event) => {
          if (!progressDragRef.current.active || progressDragRef.current.pointerId !== event.pointerId) return;
          scrollFromProgress(event.clientX, progressDragRef.current.grabOffset);
        }}
        onPointerUp={(event) => {
          progressDragRef.current.active = false;
          progressRef.current?.classList.remove("is-dragging");
          if (progressRef.current?.hasPointerCapture(event.pointerId)) progressRef.current.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          progressDragRef.current.active = false;
          progressRef.current?.classList.remove("is-dragging");
        }}
        ref={progressRef}
        role="scrollbar"
        tabIndex={0}
      >
        <span className="visual-progress-thumb" />
      </div>
      <div
        aria-label={`${label}，共 ${items.length} 个案例，双行横向浏览`}
        className={`visual-grid expanded-visual-grid visual-drag-rail ${type === "ui" ? "ui-grid" : "product-grid"}`}
        id={railId}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          stopInertia();
          railRef.current?.scrollBy({ left: event.key === "ArrowLeft" ? -360 : 360, behavior: "smooth" });
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          const rail = railRef.current;
          if (!rail) return;
          stopInertia();
          dragRef.current = {
            active: true,
            pointerId: event.pointerId,
            lastX: event.clientX,
            lastTime: window.performance.now(),
            velocity: 0,
          };
          rail.setPointerCapture(event.pointerId);
          rail.classList.add("is-dragging");
        }}
        onPointerMove={(event) => {
          const rail = railRef.current;
          if (!rail || !dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
          event.preventDefault();
          const time = window.performance.now();
          const deltaTime = Math.max(1, time - dragRef.current.lastTime);
          const deltaX = event.clientX - dragRef.current.lastX;
          rail.scrollLeft -= deltaX;
          const instantVelocity = -deltaX / deltaTime;
          dragRef.current.velocity = dragRef.current.velocity * 0.68 + instantVelocity * 0.32;
          dragRef.current.lastX = event.clientX;
          dragRef.current.lastTime = time;
        }}
        onPointerUp={(event) => {
          const rail = railRef.current;
          finishDrag();
          if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => finishDrag(false)}
        onLostPointerCapture={() => finishDrag()}
        onWheel={stopInertia}
        ref={railRef}
        role="region"
        tabIndex={0}
      >
        {items.map((item, index) => (
          <article className="visual-card" key={item.id}>
            <div className={`visual-image ${type === "ui" ? "ui-image" : ""}`}>
              <img alt={item.title} src={assetUrl(item.image)} loading="lazy" draggable={false} />
              <span className="visual-category-badge">{item.category}</span>
              <div className="visual-tag-bubbles" aria-label="识别标签">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <span className="visual-index">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="visual-copy">
              <h4>{item.title}</h4>
              <p>{item.caption}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function PortfolioPage() {
  const [activeSection, setActiveSection] = useState("framework");
  const [activeI2V, setActiveI2V] = useState("i2v-rain-seedance");
  const [visibleRadarModels, setVisibleRadarModels] = useState<Set<string>>(
    () => new Set(conclusions.t2v.radars[0].series.map((item) => item.name)),
  );
  const [focusedRadarModel, setFocusedRadarModel] = useState<string | null>(null);
  const [aestheticFilter, setAestheticFilter] = useState<AestheticCategory>("镜头语言");
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticCase | null>(null);

  useEffect(() => {
    let ticking = false;
    let hashTimers: number[] = [];
    const syncSection = () => {
      const marker = window.scrollY + 170;
      let current: (typeof navItems)[number]["id"] = navItems[0].id;
      navItems.forEach(({ id }) => {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= marker) current = id;
      });
      setActiveSection(current);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(syncSection);
      }
    };
    const alignHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return syncSection();
      const target = document.getElementById(id);
      if (!target) return;
      window.scrollTo({ top: Math.max(0, target.offsetTop - 86), behavior: "instant" as ScrollBehavior });
      if (navItems.some((item) => item.id === id)) setActiveSection(id);
    };
    const openHash = () => {
      hashTimers.forEach((timer) => window.clearTimeout(timer));
      hashTimers = [0, 80, 280, 760].map((delay) => window.setTimeout(alignHash, delay));
    };
    window.history.scrollRestoration = "manual";
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", openHash);
    window.addEventListener("popstate", openHash);
    window.addEventListener("load", openHash);
    openHash();
    document.fonts?.ready.then(openHash);
    return () => {
      hashTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", openHash);
      window.removeEventListener("popstate", openHash);
      window.removeEventListener("load", openHash);
    };
  }, []);

  useEffect(() => {
    if (!selectedAesthetic) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedAesthetic(null);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedAesthetic]);

  useEffect(() => {
    document.querySelector<HTMLAnchorElement>(`.top-nav a[href="#${activeSection}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeSection]);

  const filteredAesthetics = useMemo(
    () => aestheticCases.filter((item) => item.category === aestheticFilter),
    [aestheticFilter],
  );
  const i2vCases = evaluationCases.filter((item) => item.modality === "图生视频");
  const currentI2V = i2vCases.find((item) => item.id === activeI2V) ?? i2vCases[0];
  const t2vCases = evaluationCases.filter((item) => item.modality === "文生视频");
  const avCases = evaluationCases.filter((item) => item.modality === "音视频");

  const toggleRadarModel = (model: string) => {
    setVisibleRadarModels((current) => {
      const next = new Set(current);
      if (next.has(model)) {
        if (next.size === 1) return current;
        next.delete(model);
      } else {
        next.add(model);
      }
      return next;
    });
  };

  const goToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    window.history.pushState(null, "", `#${id}`);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  };

  return (
    <main id="top">
      <header className="site-header">
        <a className="site-mark" href="#top" aria-label="返回页面顶部"><span className="mark-dot" /><span>MM · EVAL</span></a>
        <nav className="top-nav" aria-label="页面章节">
          {navItems.map(({ id, label }) => (
            <a
              className={activeSection === id ? "active" : ""}
              aria-current={activeSection === id ? "location" : undefined}
              href={`#${id}`}
              key={id}
              onClick={(event) => goToSection(event, id)}
            >
              {label}
            </a>
          ))}
        </nav>
        <a className="index-link" href="/">返回作品集 <ChevronRight size={15} /></a>
      </header>

      <section className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">MULTIMODAL AI EVALUATION · VISUAL ANNOTATION</p>
          <h1 id="hero-title">让模型表现，<span>落到可复核的证据里。</span></h1>
          <p className="hero-lead">一个聚焦多模态 AI 评测与视觉标注的作品项目，呈现文生视频、图生视频、音视频的评测方法与模型结论，以及美学、产品和界面的结构化标注思路。</p>
          <div className="hero-actions">
            <a className="primary-action" href="#framework" onClick={(event) => goToSection(event, "framework")}>查看评测方法 <ArrowDown size={17} /></a>
            <span className="quiet-note">评测结论 · 典型案例 · 标注知识库</span>
          </div>
        </div>
        <div className="hero-board" aria-label="项目内容结构">
          <div className="board-topline"><span>PROJECT STRUCTURE</span><span className="live-indicator"><i /> EVALUATION × ANNOTATION</span></div>
          <div className="prompt-card"><span className="prompt-label">项目范围</span><p>三类生成评测 × 模型数据对照 × 可复核案例 × 视觉标注方法</p></div>
          <div className="board-grid">
            <div className="board-preview preview-a"><Video size={20} /><span>模型评测</span><small>框架 · 数据 · 结论 · 案例</small></div>
            <div className="board-preview preview-b"><Captions size={20} /><span>视觉标注</span><small>美学 · 产品 · 界面 · Caption</small></div>
          </div>
          <div className="mini-rubric">
            {["拆任务", "定维度", "看样本", "对分数", "写结论"].map((item, index) => <div key={item}><span>{item}</span><b>{String(index + 1).padStart(2, "0")}</b></div>)}
          </div>
          <div className="board-verdict"><Check size={16} /><span>指标、结论与具体视频、图片和声音证据保持对应</span></div>
        </div>
        <div className="hero-facts" aria-label="项目内容规模">
          <div><strong>03</strong><span>评测方向</span></div>
          <div><strong>07</strong><span>典型视频案例</span></div>
          <div><strong>57</strong><span>美学概念</span></div>
          <div><strong>42</strong><span>视觉 Caption</span></div>
        </div>
      </section>

      <section className="section-shell content-section" id="framework">
        <SectionHeading index="01" label="EVALUATION FRAMEWORK" title="三类任务，三条判断链路" description="每个方向先明确输入与目标，再选择共性维度、专项维度和评分锚点。结构保持一致，观察重点随模态改变。" />
        <div className="framework-stack">
          {frameworks.map((item, index) => (
            <article className="framework-story" key={item.id}>
              <div className="framework-index"><span>0{index + 1}</span><b>{item.code}</b></div>
              <div className="framework-main">
                <div className="framework-title"><div><span>{item.modality}</span><h3>{item.title}</h3></div><p>{item.focus}</p></div>
                <div className="framework-flow" aria-label={`${item.modality}评测流程`}>
                  {item.model.map((step, stepIndex) => <div key={step}><span>{String(stepIndex + 1).padStart(2, "0")}</span><strong>{step}</strong>{stepIndex < item.model.length - 1 && <ChevronRight size={16} />}</div>)}
                </div>
                <div className="framework-matrix">
                  <div><span>共性维度</span><div>{item.common.map((dimension) => <b key={dimension}>{dimension}</b>)}</div></div>
                  <div><span>专项重点</span><div>{item.special.map((dimension) => <b key={dimension}>{dimension}</b>)}</div></div>
                </div>
                <div className="anchor-line">
                  {item.anchors.map((anchor) => <div key={anchor.score}><strong>{anchor.score}</strong><span>{anchor.text}</span></div>)}
                  <p>{item.result}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="conclusions-section" id="conclusions">
        <div className="section-shell content-section">
          <SectionHeading index="02" label="EVALUATION FINDINGS" title="结论由数据和样本共同支撑" description="图表呈现模型差异，短结论解释差异发生在哪个维度、场景或样本现象中。" />
          <div className="conclusion-stack">
            <article className="conclusion-story t2v-conclusion">
              <div className="conclusion-head">
                <div className="conclusion-copy"><span>T2V</span><h3>{conclusions.t2v.title}</h3><p>{conclusions.t2v.meta}</p></div>
                <div className="conclusion-score">
                  <span>均分最高模型：{conclusions.t2v.topModel}</span>
                  <strong>4.70<small>{conclusions.t2v.unit}</small></strong>
                </div>
              </div>
              <div className="conclusion-grid">
                <div className="chart-panel">
                  <div className="chart-legend"><span><i />综合均分</span><span><b />困难任务均分</span><em>● 高分样本占比</em></div>
                  {conclusions.t2v.series.map((item) => <MetricBar key={item.name} label={item.name} value={item.overall} max={5} color={item.color} secondary={{ value: item.hard, label: "困难" }} />)}
                  <div className="rate-row">{conclusions.t2v.series.map((item) => <span key={item.name}><b>{item.highRate}%</b>{item.name.split(" ")[0]}</span>)}</div>
                </div>
                <div className="finding-list">{conclusions.t2v.findings.map((text, index) => <div key={text}><span>0{index + 1}</span><p>{text}</p></div>)}</div>
              </div>
              <div className="radar-section">
                <div className="radar-toolbar">
                  <div><span className="small-index">DUAL FIVE-DIMENSION VIEW</span><h4>通用能力与场景专项的双五维对照</h4><p>点击模型可同时筛选两张图，悬停曲线可突出查看。</p></div>
                  <div className="radar-legend" aria-label="双五维图模型筛选">
                    {conclusions.t2v.radars[0].series.map((item) => (
                      <button
                        aria-pressed={visibleRadarModels.has(item.name)}
                        className={visibleRadarModels.has(item.name) ? "active" : ""}
                        key={item.name}
                        onClick={() => toggleRadarModel(item.name)}
                        onFocus={() => setFocusedRadarModel(item.name)}
                        onBlur={() => setFocusedRadarModel(null)}
                        onMouseEnter={() => setFocusedRadarModel(item.name)}
                        onMouseLeave={() => setFocusedRadarModel(null)}
                        style={{ "--series-color": item.color } as React.CSSProperties}
                        type="button"
                      ><i />{item.name}</button>
                    ))}
                  </div>
                </div>
                <div className="radar-grid">
                  {conclusions.t2v.radars.map((radar) => <RadarChart focusedModel={focusedRadarModel} key={radar.id} radar={radar} setFocusedModel={setFocusedRadarModel} visibleModels={visibleRadarModels} />)}
                </div>
              </div>
            </article>

            <article className="conclusion-story i2v-conclusion">
              <div className="conclusion-head">
                <div className="conclusion-copy"><span>I2V</span><h3>{conclusions.i2v.title}</h3><p>{conclusions.i2v.meta}</p></div>
                <div className="conclusion-score">
                  <span>均分最高模型：{conclusions.i2v.topModel}</span>
                  <strong>91.67<small>{conclusions.i2v.unit}</small></strong>
                </div>
              </div>
              <div className="conclusion-grid i2v-chart-grid">
                <div className="chart-panel model-ranking">
                  {conclusions.i2v.series.map((item, index) => (
                    <div className="rank-line" key={item.name}>
                      <span>0{index + 1}</span><strong>{item.name}</strong>
                      <div><i style={{ width: `${item.score}%`, background: item.color }} /></div>
                      <b>{item.score}</b>
                    </div>
                  ))}
                </div>
                <div className="dimension-panel compact-dimensions win-rate-panel">
                  <span className="small-index">任务级胜率 / 24 个完全配对任务</span>
                  {conclusions.i2v.winRates.map((item) => <MetricBar key={item.name} label={item.name} value={item.value} valueLabel={`${item.value.toFixed(2)}%`} max={100} color={item.color} />)}
                </div>
              </div>
              <div className="wide-findings">{conclusions.i2v.findings.map((text, index) => <div key={text}><span>0{index + 1}</span><p>{text}</p></div>)}</div>
            </article>

            <article className="conclusion-story av-conclusion">
              <div className="conclusion-head">
                <div className="conclusion-copy"><span>AV</span><h3>{conclusions.av.title}</h3><p>{conclusions.av.meta}</p></div>
                <div className="conclusion-score">
                  <span>均分最高模型：{conclusions.av.topModel}</span>
                  <strong>95.55<small>{conclusions.av.unit}</small></strong>
                </div>
              </div>
              <div className="av-summary-grid">
                <div className="chart-panel model-ranking av-ranking">
                  {conclusions.av.series.map((item, index) => (
                    <div className="rank-line" key={item.name}>
                      <span>0{index + 1}</span><strong>{item.name}</strong>
                      <div><i style={{ width: `${item.score}%`, background: item.color }} /></div>
                      <b>{item.score.toFixed(2)}</b><small>20 条样本</small>
                    </div>
                  ))}
                </div>
                <div className="audio-gap-panel compact-dimensions">
                  <div className="audio-gap-head"><span className="small-index">声音维度均分 / 5.00</span><div><span><i />音视频同步</span><span><b />音频呈现力</span></div></div>
                  {conclusions.av.audioDimensions.map((item) => (
                    <div className="audio-gap-row" key={item.name}>
                      <div><strong>{item.name}</strong><span>{item.sync.toFixed(2)} / {item.expression.toFixed(2)}</span></div>
                      <div><i style={{ width: `${item.sync * 20}%` }} /><b style={{ width: `${item.expression * 20}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wide-findings">{conclusions.av.findings.map((text, index) => <div key={text}><span>0{index + 1}</span><p>{text}</p></div>)}</div>
            </article>
          </div>
        </div>
      </section>

      <section className="cases-section" id="cases">
        <div className="section-shell content-section">
          <SectionHeading light index="03" label="SELECTED CASES" title="同一任务，回到具体媒体判断" description="媒体、输入条件、分数、Prompt 与结论保持在同一案例区域，观看现象可以直接对应前方图表中的模型差异。" />
          <article className="case-block vertical-case-block">
            <div className="case-intro"><div className="case-icon"><Film size={21} /></div><div><p className="eyebrow">TEXT TO VIDEO</p><h3>同题双样本：30 / 30 与 24 / 30</h3></div><span className="case-count">2 条独立样本</span></div>
            <div className="prompt-quote"><span>PROMPT</span><p>城市街头主体连续运动，保持人物身份、环境空间与镜头方向稳定。</p></div>
            <div className="vertical-case-grid two-up">
              {t2vCases.map((item) => <article className="media-top-card" key={item.id}><div className="case-media"><video controls muted playsInline preload="metadata" src={assetUrl(item.media)} /></div><CaseCopy item={item} /></article>)}
            </div>
          </article>

          <article className="case-block vertical-case-block">
            <div className="case-intro"><div className="case-icon"><ImageIcon size={21} /></div><div><p className="eyebrow">IMAGE TO VIDEO</p><h3>同一输入图：100 / 78 / 39</h3></div><span className="case-count">3 个模型</span></div>
            <div className="case-tabs" role="tablist" aria-label="图生视频案例切换">
              {i2vCases.map((item, index) => <button role="tab" aria-selected={activeI2V === item.id} className={activeI2V === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setActiveI2V(item.id)}><span>0{index + 1}</span>{item.model} · {item.score}</button>)}
            </div>
            <article className="media-top-card i2v-primary-card">
              <div className="case-media i2v-case-media"><video key={currentI2V.media} controls muted playsInline preload="metadata" src={assetUrl(currentI2V.media)} /></div>
              <div className="i2v-case-side">
                {"sourceImage" in currentI2V && currentI2V.sourceImage && <div className="source-card"><img alt="雨夜街头双人近身搏斗输入图" src={assetUrl(currentI2V.sourceImage)} /><div><span>INPUT IMAGE</span><strong>同一雨夜街头输入图</strong><p>人物身份、持剑关系、雨夜街道与画面风格作为共同参照。</p></div></div>}
                <CaseCopy item={currentI2V} />
              </div>
            </article>
          </article>

          <article className="case-block vertical-case-block av-case-block">
            <div className="case-intro"><div className="case-icon"><AudioWaveform size={21} /></div><div><p className="eyebrow">AUDIO + VIDEO</p><h3>高难度同题：89 / 67</h3></div><span className="case-count">2 条标注样本</span></div>
            <div className="audio-prompt"><Volume2 size={20} /><p>魔幻 RPG 骑乘战斗：连续完成飞行、俯冲、躲避激光与释放技能，多视角运镜和空间声场需与动作逐帧同步。</p><span>相同任务</span></div>
            <div className="vertical-case-grid two-up">
              {avCases.map((item) => <article className="media-top-card" key={item.id}><div className="case-media"><video controls muted playsInline preload="metadata" src={assetUrl(item.media)} /></div><CaseCopy item={item} /></article>)}
            </div>
            <div className="shared-comparison">
              <div><span className="small-index">DIMENSION COMPARISON · 单项满分 5 分</span><h4>叙事连续、动作关系与声音表现形成主要分差</h4></div>
              <div className="shared-bars dark-bars">{conclusions.av.caseDimensions.map((item) => <div className="shared-bar" key={item.name}><span>{item.name}</span><div><i style={{ width: `${item.high * 20}%` }} /><b style={{ width: `${item.low * 20}%` }} /></div><em className="shared-score"><strong>{item.high}</strong><span>/</span><u>{item.low}</u><small>/ 5</small></em></div>)}</div>
              <div className="legend score-order-legend"><span><i />Seedance 2.0</span><span><i />SkyReels V4</span></div>
            </div>
          </article>
        </div>
      </section>

      <section className="section-shell content-section" id="annotation">
        <SectionHeading index="04" label="ANNOTATION SYSTEM" title="标签负责归类，Caption 负责复现" description="标注先拆解任务与观察项，再记录事实、选择标签和写出完整 Caption；分数与结论都落在同一片段或画面区域。" />
        <div className="annotation-rail">
          {annotationSchema.map((item, index) => <article key={item.step}><span>{item.step}</span><div><h3>{item.title}</h3><p>{item.text}</p></div>{index < annotationSchema.length - 1 && <ChevronRight size={18} />}</article>)}
        </div>
        <div className="annotation-example">
          <div className="annotation-labels"><Tag size={20} /><span>对象一致性</span><span>动作音效</span><span>局部可见</span></div>
          <div><Captions size={21} /><p>瓶身在旋转过程中保持轮廓与标签位置稳定，水滴接触桌面的瞬间出现对应音效；片尾音乐音量降低后，产品名称与口播信息仍然清晰。</p></div>
        </div>
      </section>

      <section className="aesthetic-section" id="aesthetics">
        <div className="section-shell content-section">
          <SectionHeading index="05" label="AESTHETIC KNOWLEDGE BASE" title="把美学概念写成可识别的视觉证据" description="卡片保留概念、标签与核心说明。点击任意案例可查看形成机制、可识别特征与相邻概念。" />
          <div className="filter-bar" aria-label="美学类别筛选">
            {aestheticCategories.map((category) => <button className={aestheticFilter === category ? "active" : ""} type="button" key={category} onClick={() => setAestheticFilter(category)}>{category}<span>{aestheticCases.filter((item) => item.category === category).length}</span></button>)}
          </div>
          <div className="aesthetic-grid expanded-aesthetic-grid">
            {filteredAesthetics.map((item) => (
              <article className="aesthetic-card" key={item.id}>
                <AestheticMedia item={item} />
                <button className="aesthetic-copy" type="button" aria-label={`查看${item.title}完整说明`} onClick={() => setSelectedAesthetic(item)}>
                  <div className="aesthetic-titleline"><h3>{item.title}</h3><Eye size={17} /></div><TagRow tags={item.tags} /><p>{item.summary}</p>
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-shell content-section" id="visual">
        <SectionHeading index="06" label="VISUAL CONTENT ANNOTATION" title="产品与界面，分别写清可见设计" description="两类图片使用各自的观察顺序。每张图片下方直接给出完整 Caption，内容来自主体、结构、材质、布局、组件与状态等可见信息。" />

        <section className="visual-subsection" aria-labelledby="product-title">
          <div className="visual-header"><div><Box size={21} /><span>PRODUCT IMAGE · 21 CASES</span><h3 id="product-title">产品设计标注</h3></div><p>从产品主体和设计风格进入，再描述形态结构、CMF 与人机关系。</p></div>
          <div className="method-strip">
            {visualMethods.product.steps.map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < visualMethods.product.steps.length - 1 && <ChevronRight size={16} />}</div>)}
          </div>
          <div className="caption-example"><Captions size={21} /><div><span>CAPTION EXAMPLE</span><p>{visualMethods.product.example}</p></div></div>
          <VisualCaseRail items={productCases} type="product" />
        </section>

        <section className="visual-subsection ui-subsection" aria-labelledby="ui-title">
          <div className="visual-header ui-header"><div><MousePointer2 size={21} /><span>INTERFACE IMAGE · 21 CASES</span><h3 id="ui-title">交互界面标注</h3></div><p>从页面主体和视觉样式进入，再描述布局、组件内容与画面中呈现的交互状态。</p></div>
          <div className="method-strip ui-method-strip">
            {visualMethods.ui.steps.map((step, index) => <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < visualMethods.ui.steps.length - 1 && <ChevronRight size={16} />}</div>)}
          </div>
          <div className="caption-example ui-caption-example"><Captions size={21} /><div><span>CAPTION EXAMPLE</span><p>{visualMethods.ui.example}</p></div></div>
          <VisualCaseRail items={uiCases} type="ui" />
        </section>

        <div className="closing-panel"><div><Sparkles size={24} /><p className="eyebrow">ONE CONSISTENT PRINCIPLE</p><h2>好的 Caption，让读者能从图片中复现判断。</h2></div><div className="closing-points"><span><Eye size={18} />先写可见主体</span><span><Layers3 size={18} />再写结构关系</span><span><ScanLine size={18} />最后写质量特征</span></div></div>
      </section>

      <footer className="site-footer section-shell"><span>Multimodal AI Evaluation & Annotation</span><span>方法 · 数据 · 案例 · Caption</span><a href="#top">回到顶部 ↑</a></footer>

      {selectedAesthetic && (
        <div className="aesthetic-modal" role="dialog" aria-modal="true" aria-labelledby="aesthetic-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAesthetic(null); }}>
          <article className="aesthetic-detail-card">
            <button className="modal-close" type="button" aria-label="关闭美学案例" autoFocus onClick={() => setSelectedAesthetic(null)}><X size={20} /></button>
            <AestheticMedia item={selectedAesthetic} detail />
            <div className="detail-copy">
              <p className="eyebrow">AESTHETIC CONCEPT</p><h2 id="aesthetic-modal-title">{selectedAesthetic.title}</h2><TagRow tags={selectedAesthetic.tags} /><p className="detail-summary">{selectedAesthetic.summary}</p>
              <div className="detail-sections">
                <section><span>01</span><div><h3>形成机制</h3><p>{selectedAesthetic.mechanism}</p></div></section>
                <section><span>02</span><div><h3>可识别特征</h3><p>{selectedAesthetic.traits}</p></div></section>
                <section><span>03</span><div><h3>相邻概念</h3><p>{selectedAesthetic.boundary}</p></div></section>
              </div>
            </div>
          </article>
        </div>
      )}
    </main>
  );
}
