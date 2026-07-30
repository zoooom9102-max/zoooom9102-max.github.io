/**
 * Project index (项目索引) — rebuilt 2026-07-29.
 *
 * Four showcase entries, each with its own interaction idea (巧思):
 *   01 page     — card → in-site subpage (under development)
 *   02 external — card → GitHub (pipeline nodes light up on hover)
 *   03 video    — inline muted autoplay strip, click → fullscreen w/ sound
 *   04 links    — dual platform plates (小红书 / GitHub)
 *
 * NOTE: item 02 links to the workflow REPO; item 04's GitHub plate uses
 * the profile URL (GITHUB_PROFILE_URL).
 */

export interface ShowcaseLink {
  id: string;
  label: string;
  labelEn: string;
  note: string;
  url: string;
}

export interface ShowcaseItem {
  id: string;
  index: string;
  kind: "page" | "external" | "video" | "links" | "gallery";
  title: string;
  titleEn: string;
  tag: string;
  tagEn: string;
  description: string;
  /** Cursor-follow chip verb shown while hovering the row. */
  action: string;
  image?: string;
  imageAlt?: string;
  video?: string;
  url?: string;
  links?: ShowcaseLink[];
}

export const GITHUB_PROFILE_URL = "https://github.com/zoooom9102-max";

export const showcaseItems: ShowcaseItem[] = [
  {
    id: "eval-annotation-method",
    index: "01",
    kind: "page",
    title: "我的评测与标注思路",
    titleEn: "Evaluation & Annotation Methodology",
    tag: "方法论",
    tagEn: "METHODOLOGY",
    description:
      "从盲评流程、分级评测集到标注质检与 Bad Case 归因——一套在真实项目里打磨出来的评测与标注方法论。",
    action: "进入阅读",
    image: "/media/eval-method-cover.png",
    url: "/work/evaluation-labeling/",
    imageAlt: "视频帧网格上的橙色标注框与评测标记",
  },
  {
    id: "auto-preannotation-workflow",
    index: "02",
    kind: "external",
    title: "自动化标注工作流",
    titleEn: "Automated Pre-annotation Workflow",
    tag: "自动化",
    tagEn: "AUTOMATION",
    description:
      "面向视频 Caption 训练数据的自动化预标注方案，配套开发视频预处理插件与结果拆列工具，支持批量稳定运行。",
    action: "打开 GitHub",
    image: "/media/workflow-screenshot.png",
    imageAlt: "自动化预标注工作流界面截图",
    url: "https://github.com/zoooom9102-max/dify-video-caption-preannotation",
  },
  {
    id: "game-cg-montage",
    index: "03",
    kind: "video",
    title: "游戏 CG 混剪",
    titleEn: "Game CG Montage",
    tag: "视频创作",
    tagEn: "VIDEO",
    description:
      "将大量游戏 CG 等素材重新剪辑，配合音乐、音效和视觉效果，制作成具有统一主题和情绪的视频。",
    action: "全屏播放",
    video: "/media/game-cg-montage.mp4",
  },
  {
    id: "content-output",
    index: "04",
    kind: "links",
    title: "内容输出与知识积累",
    titleEn: "Content & Knowledge",
    tag: "持续更新",
    tagEn: "CONTENT",
    description: "保持敏锐，保持激情，不断前进。",
    action: "前往主页",
    links: [
      {
        id: "xiaohongshu",
        label: "小红书主页",
        labelEn: "XIAOHONGSHU",
        note: "AI 训练日常 · 方法论笔记",
        url: "https://www.xiaohongshu.com/user/profile/62a9b963000000001902b788",
      },
      {
        id: "github",
        label: "GitHub 主页",
        labelEn: "GITHUB",
        note: "工作流 · 插件 · 工具源码",
        url: GITHUB_PROFILE_URL,
      },
    ],
  },
  {
    id: "design-works",
    index: "05",
    kind: "gallery",
    title: "设计作品",
    titleEn: "Design Works",
    tag: "视觉设计",
    tagEn: "DESIGN",
    description: "好看，且经看。",
    action: "查看图稿",
  },
];
