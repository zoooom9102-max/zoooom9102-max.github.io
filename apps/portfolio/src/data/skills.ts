import type { Skill } from "../types/content";

export const skills: Skill[] = [
  {
    id: "multimodal-training",
    title: "多模态数据训练",
    description:
      "覆盖 T2V、I2V 场景的数据筛选、Caption 生产、清洗、复核、质量验收与训练反馈。",
    icon: "video",
    status: "published",
  },
  {
    id: "video-model-evaluation",
    title: "视频模型评测",
    description:
      "构建评测集、难度分层与场景专项维度，完成盲评、争议复核、问题归因和可视化报告。",
    icon: "evaluation",
    status: "published",
  },
  {
    id: "project-quality",
    title: "项目与质量管理",
    description:
      "能够承接需求、制定规则、组织试标培训、管理生产与质检，并通过案例复盘持续迭代标准。",
    icon: "quality",
    status: "published",
  },
  {
    id: "automation-workflow",
    title: "自动化工作流",
    description:
      "使用 Python、Dify 与大模型 API 自动化数据清洗、规则校验、评测统计和报告生成。",
    icon: "automation",
    status: "published",
  },
  {
    id: "design-aesthetics",
    title: "设计与专业美学",
    description:
      "将镜头语言、空间关系、造型、色彩、材质和交互体验转化为可执行的评测维度。",
    icon: "design",
    status: "published",
  },
];
