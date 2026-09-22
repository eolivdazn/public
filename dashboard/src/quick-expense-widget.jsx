import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ExpenseForm } from "./components/ExpenseForm";
import { submitExpense } from "./lib/submitExpense.js";
import dashboardStyles from "./styles.css?inline";

const WIDGET_CHROME_CSS = `
  .trip-quick-expense-details {
    margin-top: 1.5em;
  }
  .trip-quick-expense-summary {
    cursor: pointer;
    font-weight: 600;
    color: #2f63ff;
    padding: 4px 0;
  }
  .trip-quick-expense-body {
    margin-top: 1em;
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
      <summary className="trip-quick-expense-summary">+ Add expense</summary>
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
  // there (--accent, --border, etc.) would otherwise resolve to nothing. :host is the
  // shadow-tree equivalent of :root for this purpose.
  const scopedStyles = dashboardStyles.replace(":root", ":host");

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
