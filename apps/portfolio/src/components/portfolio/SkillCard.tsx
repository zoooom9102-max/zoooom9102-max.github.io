import {
  Clapperboard,
  ClipboardCheck,
  Palette,
  Radar,
  Workflow,
} from "lucide-react";
import type { Skill } from "../../types/content";
import { DecorativeFrame } from "../ui/DecorativeFrame";

const icons = {
  video: Clapperboard,
  evaluation: Radar,
  quality: ClipboardCheck,
  automation: Workflow,
  design: Palette,
};

export function SkillCard({ skill, index }: { skill: Skill; index: number }) {
  const Icon = icons[skill.icon];
  return (
    <DecorativeFrame>
      <article className="skill-card">
        <div className="skill-card__top">
          <span className="skill-card__icon">
            <Icon aria-hidden="true" />
          </span>
          <span>0{index + 1}</span>
        </div>
        <h2>{skill.title}</h2>
        <p>{skill.description}</p>
      </article>
    </DecorativeFrame>
  );
}
