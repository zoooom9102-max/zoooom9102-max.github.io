import { Mail, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScrollMappedVideo } from "../components/portfolio/ScrollMappedVideo";
import { SectionHeading } from "../components/ui/SectionHeading";
import { siteConfig } from "../data/site";

const SCROLL_VIDEO_SRC = "/media/section-scroll-video.mp4";
const SCROLL_VIDEO_POSTER = "/media/section-scroll-video-poster.jpg";

type CopyKey = "phone" | "email";

export function ContactPage() {
  const [copied, setCopied] = useState<CopyKey | null>(null);
  const [hovered, setHovered] = useState<CopyKey | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  // Chip content: copied feedback wins over the hover hint; when the copied
  // state times out while still hovering, the chip falls back to the hint.
  const chipMode = copied ? "copied" : hovered ? "hint" : null;

  // Cursor-follow copy chip (same pattern as the showcase action chip):
  // trails the pointer with a light spring; only visible right after a
  // copy. Portaled to <body> so no transformed ancestor can break the
  // fixed positioning (the scroll-video stage clips/transforms).
  useEffect(() => {
    const chip = chipRef.current;
    if (!chip) return;
    let frame: number | null = null;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      chip.style.transform = `translate3d(${cx + 16}px, ${cy + 16}px, 0)`;
      if (Math.abs(x - cx) > 0.2 || Math.abs(y - cy) > 0.2) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = null;
      }
    };
    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (frame === null) frame = window.requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const chip = chipRef.current;
    if (chip) chip.dataset.visible = chipMode ? "true" : "false";
  }, [chipMode]);

  // Click-to-copy replaces the tel:/mailto: app jumps. Clipboard API first,
  // hidden-textarea execCommand fallback for non-secure contexts. The
  // on-page text never changes — feedback lives in the cursor chip.
  const copyValue = async (key: CopyKey, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = value;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    setCopied(key);
    window.setTimeout(() => {
      setCopied((current) => (current === key ? null : current));
    }, 1600);
  };

  const contactContent = (
    <div className="contact-page__content">
      <SectionHeading
        index="06"
        label="CONTACT"
        title="联系"
        accent="方式"
        description="保持开放，期待与你讨论模型训练、测评与设计。"
      />
      <div className="contact-panel">
        <div className="contact-panel__primary">
          <div className="contact-method">
            <span className="contact-method__index">01</span>
            <p>MOBILE / WECHAT</p>
            <button
              type="button"
              data-copied={copied === "phone" ? "true" : "false"}
              onClick={() => void copyValue("phone", siteConfig.phone ?? "")}
              onPointerEnter={() => setHovered("phone")}
              onPointerLeave={() =>
                setHovered((current) => (current === "phone" ? null : current))
              }
              aria-label={`复制电话 ${siteConfig.phone}`}
            >
              <Phone size={24} aria-hidden="true" />
              {siteConfig.phone}
            </button>
          </div>
          <div className="contact-method">
            <span className="contact-method__index">02</span>
            <p>EMAIL</p>
            <button
              type="button"
              data-copied={copied === "email" ? "true" : "false"}
              onClick={() => void copyValue("email", siteConfig.email ?? "")}
              onPointerEnter={() => setHovered("email")}
              onPointerLeave={() =>
                setHovered((current) => (current === "email" ? null : current))
              }
              aria-label={`复制邮箱 ${siteConfig.email}`}
            >
              <Mail size={24} aria-hidden="true" />
              {siteConfig.email}
            </button>
          </div>
        </div>
      </div>
      {createPortal(
        <div
          ref={chipRef}
          className="contact-copy-chip"
          data-visible="false"
          data-mode={chipMode ?? "hint"}
          aria-hidden="true"
        >
          {chipMode === "copied" ? (
            <>
              <span>已复制到剪贴板 · COPIED</span>
              <i>✓</i>
            </>
          ) : chipMode === "hint" ? (
            <span>点击复制 · CLICK TO COPY</span>
          ) : null}
        </div>,
        document.body,
      )}
    </div>
  );

  return (
    <section
      id="contact"
      className="page-section page-container contact-page single-page-section"
    >
      <ScrollMappedVideo
        sectionId="contact"
        src={SCROLL_VIDEO_SRC}
        poster={SCROLL_VIDEO_POSTER}
        revealStart={0.84}
      >
        {contactContent}
      </ScrollMappedVideo>
    </section>
  );
}
