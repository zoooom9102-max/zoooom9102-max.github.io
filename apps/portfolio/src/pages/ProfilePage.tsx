import { ArrowRight, FileDown } from "lucide-react";
import { DecorativeFrame } from "../components/ui/DecorativeFrame";
import { Reveal } from "../components/ui/Reveal";
import { SectionHeading } from "../components/ui/SectionHeading";
import { profile } from "../data/profile";

export function ProfilePage() {
  return (
    <section
      id="portfolio"
      className="page-section page-container profile-page single-page-section"
    >
      <Reveal className="profile-page__content">
        <SectionHeading
          index="02"
          label="PROFILE"
          title={profile.title}
          accent={profile.titleAccent}
        />
        <p className="profile-page__name">
          <strong>李文政</strong>
          <span>WENZO LEE</span>
        </p>
        <div className="profile-page__intro">
          <p>{profile.introduction}</p>
          <p lang="en">{profile.introductionEn}</p>
        </div>
        <dl className="profile-list">
          <div>
            <dt>方向</dt>
            <dd>{profile.identity.join(" / ")}</dd>
          </div>
          <div>
            <dt>能力</dt>
            <dd>{profile.strengths.join(" / ")}</dd>
          </div>
          <div>
            <dt>工具</dt>
            <dd>{profile.tools.join(" / ")}</dd>
          </div>
        </dl>
        <div className="profile-page__actions">
          {profile.resumeUrl && (
            <a
              className="action-button action-button--solid"
              href={profile.resumeUrl}
            >
              <FileDown size={18} /> 下载简历
            </a>
          )}
          <a className="action-button action-button--outline" href="#contact">
            联系我 <ArrowRight size={18} />
          </a>
        </div>
      </Reveal>

      <Reveal
        className="profile-visuals"
        delay={0.1}
        distance={24}
        ariaLabel="个人视觉与素材区域"
      >
        <DecorativeFrame>
          <figure className="profile-portrait">
            {profile.portrait && (
              <img
                src={profile.portrait}
                alt="李文政个人照片"
                loading="lazy"
                decoding="async"
              />
            )}
            <div className="profile-portrait__scan" aria-hidden="true" />
            <figcaption>
              <span>01 · PORTRAIT</span>
              <strong>李文政 / WENZO LEE</strong>
            </figcaption>
          </figure>
        </DecorativeFrame>
        <DecorativeFrame>
          <div className="profile-fact-card">
            <div className="profile-fact-card__header">
              <span>02</span>
              <span>EDUCATION</span>
            </div>
            <div>
              <strong>江南大学</strong>
              <p>设计学 · 硕士</p>
            </div>
            <p>
              {profile.graduation} · {profile.english}
            </p>
          </div>
        </DecorativeFrame>
        <DecorativeFrame>
          <div className="profile-fact-card profile-fact-card--status">
            <div className="profile-fact-card__header">
              <span>03</span>
              <span>CAREER STATUS</span>
            </div>
            <div>
              <strong>
                {profile.workPreference} · {profile.availability}
              </strong>
              <p>OPEN TO WORK</p>
            </div>
            <p>READY TO COLLABORATE</p>
          </div>
        </DecorativeFrame>
      </Reveal>
    </section>
  );
}
