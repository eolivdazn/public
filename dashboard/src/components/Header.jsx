import { Icon } from "./Icon";
import { SITE_ENV_LABEL, SITE_REF } from "../lib/siteEnv.js";

export function Header() {
  return (
    <header className={SITE_ENV_LABEL ? "app-bar is-env" : "app-bar"}>
      <div className="app-bar-inner">
        <span className="app-bar-start">
          <a className="back-link" href="../index.html">
            <Icon name="arrowLeft" size={18} />
            <span>Trip pages</span>
          </a>
          {SITE_ENV_LABEL ? (
            <span className="env-badge" title={SITE_REF ? `${SITE_ENV_LABEL} build of branch ${SITE_REF}` : `${SITE_ENV_LABEL} build`}>
              {SITE_ENV_LABEL}
              {SITE_REF ? <span className="env-badge-ref">{SITE_REF}</span> : null}
            </span>
          ) : null}
        </span>
        <span className="app-bar-title">Travel Dashboard</span>
      </div>
    </header>
  );
}
