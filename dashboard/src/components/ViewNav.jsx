import { Icon } from "./Icon";

const VIEW_OPTIONS = [
  { value: "finance", label: "Finance", icon: "wallet" },
  { value: "summary", label: "By year", icon: "chart" },
  { value: "audit", label: "Audit", icon: "history" }
];

// Rendered once: a fixed bottom bar on phones, inline tabs on wider screens (see .view-nav in styles.css).
export function ViewNav({ activeView, onChangeView }) {
  return (
    <nav className="view-nav" aria-label="Dashboard views">
      <ul>
        {VIEW_OPTIONS.map((option) => {
          const isActive = option.value === activeView;
          return (
            <li key={option.value}>
              <button
                type="button"
                className={isActive ? "is-active" : ""}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onChangeView(option.value)}
              >
                <Icon name={option.icon} size={22} />
                <span>{option.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
