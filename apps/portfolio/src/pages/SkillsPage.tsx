import { SkillCard } from "../components/portfolio/SkillCard";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { skills } from "../data/skills";

export function SkillsPage() {
  return (
    <section id="skills" className="page-section page-container skills-page single-page-section">
      <Reveal>
        <SectionHeading
          index="04"
          label="SKILLS"
          title="SKILLS"
          description="一套从项目管理、模型训练、测评、交付到验收的工作系统"
          align="center"
        />
      </Reveal>
      <div className="skills-grid">
        {skills.map((skill, index) => (
          <Reveal key={skill.id} delay={index * 0.07} distance={18}>
            <SkillCard skill={skill} index={index} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
