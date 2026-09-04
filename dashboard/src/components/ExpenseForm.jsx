import { useEffect, useState } from "react";
import { FormField } from "./FormField";
import { EXPENSE_CATEGORY_OPTIONS } from "../lib/expenses.js";

function defaultFormValues() {
  return {
    category: "food",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: ""
  };
}

export function ExpenseForm({
  trips,
  selectedExpenseTripSlug,
  onChangeTripSlug,
  tripSelectDisabled,
  selectedExpenseTrip,
  onSubmit,
  saving,
  status
}) {
  const [expenseForm, setExpenseForm] = useState(defaultFormValues);

  useEffect(() => {
    if (!selectedExpenseTrip) {
      return;
    }
    setExpenseForm((current) => (current.date && current.category ? current : defaultFormValues()));
  }, [selectedExpenseTrip]);

  async function handleSubmit(event) {
    event.preventDefault();
    const success = await onSubmit(expenseForm);
    if (success) {
      setExpenseForm((current) => ({
        ...current,
        amount: "",
        description: "",
        date: new Date().toISOString().slice(0, 10)
      }));
    }
  }

  return (
    <article className="panel expense-form-panel">
      <div className="section-heading-row">
        <div>
          <h2>Add expense</h2>
          <p className="section-copy">
            Log food and entertainment during the trip. Static flights and hotel stay in the markdown file.
          </p>
        </div>
      </div>

      <form className="expense-form" onSubmit={handleSubmit}>
        <div className="expense-form-grid">
          <FormField label="Trip">
            <select
              value={selectedExpenseTripSlug || ""}
              disabled={tripSelectDisabled}
              onChange={(event) => onChangeTripSlug(event.target.value)}
            >
              {trips.map((trip) => (
                <option key={trip.slug} value={trip.slug}>
                  {trip.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Category">
            <select
              value={expenseForm.category}
              onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
            >
              {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Amount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={expenseForm.amount}
              onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Date">
            <input
              type="date"
              value={expenseForm.date}
              onChange={(event) => setExpenseForm((current) => ({ ...current, date: event.target.value }))}
            />
          </FormField>
        </div>

        <FormField label="Description" full>
          <textarea
            rows="3"
            value={expenseForm.description}
            onChange={(event) => setExpenseForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Dinner, taxi, museum, coffee..."
          />
        </FormField>

        <div className="expense-form-actions">
          <button type="submit" disabled={!selectedExpenseTrip || saving}>
            {saving ? "Saving..." : "Save expense"}
          </button>
          <p className="expense-form-note">
            {selectedExpenseTrip
              ? `Currency: ${selectedExpenseTrip.expenses?.baseCurrency || "EUR"} · Party size: ${selectedExpenseTrip.expenses?.partySize || 2}`
              : "Select a trip to enable the form."}
          </p>
        </div>

        {status ? <p className="status success">{status}</p> : null}
      </form>
    </article>
  );
}
