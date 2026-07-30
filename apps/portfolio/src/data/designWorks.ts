/**
 * Design works (设计作品) — showcase item 05.
 * Five folders under 设计作品/, copied to public/media/design/ with
 * normalized names (cover.webp + detail-NN.webp/.webm).
 * Titles are folder-derived placeholders — rename freely.
 */

export interface DesignWorkItem {
  type: "image" | "video";
  src: string;
}

export interface DesignWork {
  id: string;
  title: string;
  titleEn: string;
  cover: string;
  /** Live product URL — renders a "前往体验" button on the cover + lightbox. */
  liveUrl?: string;
  items: DesignWorkItem[];
}

const dir = (id: string) => `/media/design/${id}`;
const imgs = (id: string, names: string[]): DesignWorkItem[] =>
  names.map((name) => ({
    type: name.endsWith(".webm") ? "video" : "image",
    src: `${dir(id)}/${name}`,
  }));

export const designWorks: DesignWork[] = [
  {
    id: "product-project-01",
    title: "产品设计 · 01",
    titleEn: "PRODUCT DESIGN 01",
    cover: `${dir("product-project-01")}/cover.webp`,
    items: imgs("product-project-01", [
      "detail-01.webp",
      "detail-02.webp",
      "detail-03.webp",
      "detail-04.webp",
      "detail-05.webp",
      "detail-06.webp",
      "detail-07.webp",
      "detail-08.webp",
    ]),
  },
  {
    id: "product-project-03",
    title: "产品设计 · 03",
    titleEn: "PRODUCT DESIGN 03",
    cover: `${dir("product-project-03")}/cover.webp`,
    items: imgs("product-project-03", [
      "cover.webp",
      "detail-01.webp",
      "detail-02.webp",
      "detail-03.webp",
    ]),
  },
  {
    id: "ui-project-01",
    title: "UI 设计 · 01",
    titleEn: "UI DESIGN 01",
    cover: `${dir("ui-project-01")}/cover.webp`,
    // ProductScope — AI 驱动的 PRD 写作 Agent，有真实可用的前后端。
    liveUrl: "https://43j4vydk4p.coze.site/",
    items: imgs("ui-project-01", ["cover.webp", "detail-01.webp"]),
  },
  {
    id: "ui-project-04",
    title: "UI 设计 · 04",
    titleEn: "UI DESIGN 04",
    cover: `${dir("ui-project-04")}/cover.webp`,
    items: imgs("ui-project-04", [
      "cover.webp",
      "detail-01.webp",
      "detail-02.webp",
      "detail-03.webm",
      "detail-04.webp",
      "detail-05.webp",
      "detail-06.webp",
    ]),
  },
  {
    id: "ui-project-05",
    title: "UI 设计 · 05",
    titleEn: "UI DESIGN 05",
    cover: `${dir("ui-project-05")}/cover.webp`,
    items: imgs("ui-project-05", ["cover.webp", "detail-01.webp"]),
  },
];
