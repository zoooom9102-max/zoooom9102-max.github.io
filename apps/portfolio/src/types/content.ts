export type ContentStatus = "placeholder" | "draft" | "published";

export interface NavigationItem {
  label: string;
  labelEn: string;
  path: string;
}

export interface HeroMediaConfig {
  enabled: boolean;
  desktopSources: Array<{ src: string; type: string }>;
  mobileSources: Array<{ src: string; type: string }>;
  desktopPoster?: string;
  mobilePoster?: string;
  focalPoint: string;
  description: string;
}

export interface StatusItem {
  label: string;
  tone: "orange" | "green" | "neutral";
}

export interface SocialLink {
  label: string;
  href: string;
  status: ContentStatus;
}

export interface SiteConfig {
  name: string;
  nameEn: string;
  displayName: string;
  monogram: string;
  version: string;
  email?: string;
  phone?: string;
  navigation: NavigationItem[];
  heroMedia: HeroMediaConfig;
  statuses: StatusItem[];
  socialLinks: SocialLink[];
}

export interface Profile {
  eyebrow: string;
  title: string;
  titleAccent: string;
  introduction: string;
  introductionEn: string;
  identity: string[];
  strengths: string[];
  tools: string[];
  education: string;
  graduation: string;
  english: string;
  workPreference: string;
  availability: string;
  portrait?: string;
  resumeUrl?: string;
  status: ContentStatus;
}

export interface Skill {
  id: string;
  title: string;
  description: string;
  icon: "video" | "evaluation" | "quality" | "automation" | "design";
  status: ContentStatus;
}

export interface TimelineEntry {
  year: string;
  title: string;
  subtitle: string;
  description: string;
  detail?: string;
  tag: string;
  status: ContentStatus;
}
