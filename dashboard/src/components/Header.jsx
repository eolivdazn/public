import { Icon } from "./Icon";

export function Header() {
  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <a className="back-link" href="../index.html">
          <Icon name="arrowLeft" size={18} />
          <span>Trip pages</span>
        </a>
        <span className="app-bar-title">Travel Dashboard</span>
      </div>
    </header>
  );
}
