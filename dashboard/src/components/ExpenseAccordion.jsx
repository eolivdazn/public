import { useState } from "react";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseLivePanel } from "./ExpenseLivePanel";
import { deleteExpenseEntry } from "../lib/api.js";
import { submitExpense } from "../lib/submitExpense.js";

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
  updateLiveEntry,
  removeLiveEntry
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expenseStatus, setExpenseStatus] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  function handleEditStart(entry) {
    setEditingEntry(entry);
    setExpenseStatus("");
  }

  function handleEditCancel() {
    setEditingEntry(null);
    setExpenseStatus("");
  }

  async function handleExpenseSubmit(formValues) {
    setSavingExpense(true);
    setExpenseStatus("");

    try {
      const result = await submitExpense({ trip: selectedExpenseTrip, formValues, editingEntry });
      if (result.entry) {
        if (result.isUpdate) {
          updateLiveEntry(result.entry);
        } else {
          addLiveEntry(result.entry);
        }
      }
      setExpenseStatus(result.message);
      if (result.isUpdate) {
        setEditingEntry(null);
      }
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
      if (editingEntry?.id === entry.id) {
        setEditingEntry(null);
      }
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
              editingEntry={editingEntry}
              onCancelEdit={handleEditCancel}
            />

            <ExpenseLivePanel
              selectedExpenseTrip={selectedExpenseTrip}
              snapshot={snapshot}
              loading={liveLoading}
              error={liveError}
              entries={entries}
              onDeleteEntry={handleExpenseDelete}
              onEditEntry={handleEditStart}
              editingEntryId={editingEntry?.id || null}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
