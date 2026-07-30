import { Link } from "react-router-dom";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";

/**
 * Placeholder for the "我的评测与标注思路" long-form subpage.
 * The real article is under development — this stub keeps the project
 * index link honest in the meantime.
 */
export function EvalMethodPage() {
  return (
    <section className="page-section page-container stub-page">
      <Reveal>
        <SectionHeading
          index="05·01"
          label="METHODOLOGY"
          title="评测与标注"
          accent="思路"
          description="Evaluation & Annotation Methodology"
        />
      </Reveal>
      <Reveal className="stub-page__body" delay={0.08} distance={14}>
        <p className="stub-page__status">
          <i aria-hidden="true" />
          WRITING IN PROGRESS · 筹备中
        </p>
        <p>
          这个子页面正在开发中。关于盲评流程、分级评测集、标注质检与
          Bad Case 归因的完整方法论长文正在整理，完成后会在这里上线。
        </p>
        <Link to="/#projects" className="stub-page__back" data-cursor="interactive">
          ← 返回项目索引
        </Link>
      </Reveal>
    </section>
  );
}
