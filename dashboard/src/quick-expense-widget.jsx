import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ExpenseForm } from "./components/ExpenseForm";
import { Icon } from "./components/Icon";
import { submitExpense } from "./lib/submitExpense.js";
import dashboardStyles from "./styles.css?inline";

const WIDGET_CHROME_CSS = `
  .trip-quick-expense-details {
    margin-top: 16px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }
  .trip-quick-expense-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    padding: 12px 16px;
    list-style: none;
    cursor: pointer;
    touch-action: manipulation;
    border-radius: inherit;
  }
  .trip-quick-expense-summary::-webkit-details-marker {
    display: none;
  }
  .trip-quick-expense-summary:hover {
    background: var(--color-surface-muted);
  }
  .trip-quick-expense-summary:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
  .trip-quick-expense-text {
    flex: 1;
    display: grid;
  }
  .trip-quick-expense-title {
    font-weight: 600;
  }
  .trip-quick-expense-subtitle {
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }
  .trip-quick-expense-details[open] .expense-toggle-chevron {
    transform: rotate(180deg);
  }
  .trip-quick-expense-body {
    padding: 16px;
    border-top: 1px solid var(--color-border);
  }
  /* The summary row already says "Add expense". */
  .trip-quick-expense-body .section-heading-row h2 {
    display: none;
  }
  .trip-quick-expense-body .panel {
    padding: 0;
    border: none;
    box-shadow: none;
    background: transparent;
  }
`;

function tripSlugFromLocation() {
  return window.location.pathname.split("/").pop().replace(/\.html$/, "");
}

function QuickExpenseWidget() {
  const [trip, setTrip] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const slug = tripSlugFromLocation();
    if (!slug) {
      setNotFound(true);
      return;
    }

    const dataUrl = new URL("dashboard-data.json", window.location.href).toString();
    fetch(dataUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const match = (data?.trips || []).find((item) => item.slug === slug);
        if (match) {
          setTrip(match);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true));
  }, []);

  async function handleSubmit(formValues) {
    setSaving(true);
    setStatus("");
    try {
      const result = await submitExpense({ trip, formValues, editingEntry: null });
      setStatus(result.message);
      return true;
    } catch (submitError) {
      setStatus(submitError.message || "Could not save expense.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (notFound || !trip) {
    return null;
  }

  return (
    <details className="trip-quick-expense-details">
      <summary className="trip-quick-expense-summary">
        <span className="expense-toggle-icon">
          <Icon name="plus" size={20} />
        </span>
        <span className="trip-quick-expense-text">
          <span className="trip-quick-expense-title">Add expense</span>
          <span className="trip-quick-expense-subtitle">Log food and fun while you're here</span>
        </span>
        <Icon name="chevronDown" size={20} className="expense-toggle-chevron" />
      </summary>
      <div className="trip-quick-expense-body">
        <ExpenseForm
          trips={[trip]}
          selectedExpenseTripSlug={trip.slug}
          onChangeTripSlug={() => {}}
          tripSelectDisabled
          selectedExpenseTrip={trip}
          onSubmit={handleSubmit}
          saving={saving}
          status={status}
          editingEntry={null}
          onCancelEdit={() => {}}
        />
      </div>
    </details>
  );
}

function mount() {
  const host = document.getElementById("trip-quick-expense-root");
  if (!host) {
    return;
  }

  const shadowRoot = host.attachShadow({ mode: "open" });

  // :root never matches inside a shadow tree, so the custom properties styles.css defines
  // there (--color-primary, --color-border, etc.) would otherwise resolve to nothing. :host is
  // the shadow-tree equivalent of :root for this purpose. Every occurrence is swapped (the
  // light tokens and the prefers-color-scheme: dark override) so the widget follows the trip
  // page's theme.
  const scopedStyles = dashboardStyles.replaceAll(":root", ":host");

  const styleEl = document.createElement("style");
  styleEl.textContent = scopedStyles + WIDGET_CHROME_CSS;
  shadowRoot.appendChild(styleEl);

  const container = document.createElement("div");
  shadowRoot.appendChild(container);

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <QuickExpenseWidget />
    </React.StrictMode>
  );
}

mount();
