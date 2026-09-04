import { useState } from "react";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseLivePanel } from "./ExpenseLivePanel";
import { postExpenseEntry, deleteExpenseEntry } from "../lib/api.js";

export function ExpenseAccordion({
  trips,
  selectedExpenseTripSlug,
  onChangeTripSlug,
  tripSelectDisabled,
  selectedExpenseTrip,
  snapshot,
  entries,
  liveLoading,
  liveError,
  addLiveEntry,
  removeLiveEntry
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);

  async function handleExpenseSubmit(formValues) {
    if (!selectedExpenseTrip) {
      setExpenseStatus("Select a trip first.");
      return false;
    }

    const amount = Number(formValues.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseStatus("Enter a valid amount greater than zero.");
      return false;
    }

    const payload = {
      tripSlug: selectedExpenseTrip.slug,
      category: formValues.category,
      amount,
      currency: selectedExpenseTrip.expenses?.baseCurrency || "EUR",
      date: formValues.date,
      description: formValues.description
    };

    setSavingExpense(true);
    setExpenseStatus("");

    try {
      const result = await postExpenseEntry(payload);
      if (result?.entry) {
        addLiveEntry(result.entry);
      }
      setExpenseStatus("Expense saved.");
      return true;
    } catch (submitError) {
      setExpenseStatus(submitError.message || "Could not save expense.");
      return false;
    } finally {
      setSavingExpense(false);
    }
  }

  async function handleExpenseDelete(entry) {
    setExpenseStatus("");

    try {
      await deleteExpenseEntry({ id: entry.id, tripSlug: entry.tripSlug });
      removeLiveEntry(entry.id);
      setExpenseStatus("Expense deleted.");
    } catch (deleteError) {
      setExpenseStatus(deleteError.message || "Could not delete expense.");
    }
  }

  return (
    <section className="panel expense-accordion">
      <button
        className="expense-toggle-button"
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Add / view expenses</span>
        <span className="expense-toggle-icon">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen ? (
        <div className="expense-accordion-body">
          <div className="expense-grid">
            <ExpenseForm
              trips={trips}
              selectedExpenseTripSlug={selectedExpenseTripSlug}
              onChangeTripSlug={onChangeTripSlug}
              tripSelectDisabled={tripSelectDisabled}
              selectedExpenseTrip={selectedExpenseTrip}
              onSubmit={handleExpenseSubmit}
              saving={savingExpense}
              status={expenseStatus}
            />

            <ExpenseLivePanel
              selectedExpenseTrip={selectedExpenseTrip}
              snapshot={snapshot}
              loading={liveLoading}
              error={liveError}
              entries={entries}
              onDeleteEntry={handleExpenseDelete}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
