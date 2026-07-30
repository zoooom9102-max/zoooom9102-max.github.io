import { siteConfig } from "../../data/site";
import { StatusPill } from "../ui/StatusPill";

export function FooterStatusBar() {
  return (
    <footer className="footer-status">
      <div className="footer-status__track" aria-label="站点状态">
        {siteConfig.statuses.map((status) => (
          <StatusPill key={status.label} {...status} />
        ))}
      </div>
      <p>
        © 2026 · {siteConfig.name} {siteConfig.displayName} · {siteConfig.version}
      </p>
    </footer>
  );
}
