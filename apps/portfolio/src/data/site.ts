import type { SiteConfig } from "../types/content";

export const siteConfig: SiteConfig = {
  name: "李文政",
  nameEn: "Wenzo Lee",
  displayName: "WENZO LEE",
  monogram: "WL",
  version: "v2026.07",
  email: "15206470229@163.com",
  phone: "15206470229",
  navigation: [
    { label: "首页", labelEn: "Home", path: "#home" },
    { label: "档案", labelEn: "Portfolio", path: "#portfolio" },
    { label: "履历", labelEn: "Timeline", path: "#timeline" },
    { label: "技能", labelEn: "Skills", path: "#skills" },
    { label: "项目", labelEn: "Projects", path: "#projects" },
    { label: "联系", labelEn: "Contact", path: "#contact" },
  ],
  heroMedia: {
    enabled: true,
    desktopSources: [
      { src: "/media/hero-video.webm", type: "video/webm" },
    ],
    mobileSources: [
      { src: "/media/hero-video.webm", type: "video/webm" },
    ],
    focalPoint: "72% 50%",
    description: "李文政个人网站 Hero 动态背景",
  },
  statuses: [
    { label: "Portfolio System", tone: "orange" },
    { label: "Data to Delivery", tone: "green" },
    { label: "Human × AI Workflow", tone: "orange" },
    { label: "Updated 2026.07", tone: "neutral" },
  ],
  socialLinks: [],
};
