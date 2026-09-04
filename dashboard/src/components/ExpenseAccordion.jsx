import { useState } from "react";
import { ExpenseForm } from "./ExpenseForm";
import { ExpenseLivePanel } from "./ExpenseLivePanel";
import { postExpenseEntry, updateExpenseEntry, deleteExpenseEntry, uploadReceipt } from "../lib/api.js";

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
    if (!selectedExpenseTrip) {
      setExpenseStatus("Select a trip first.");
      return false;
    }

    const amount = Number(formValues.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseStatus("Enter a valid amount greater than zero.");
      return false;
    }

    const isFood = formValues.category === "food";
    let receiptBlobName = isFood ? formValues.existingReceiptBlobName || null : null;

    setSavingExpense(true);
    setExpenseStatus("");

    if (isFood && formValues.receiptFile) {
      try {
        const uploadResult = await uploadReceipt(selectedExpenseTrip.slug, formValues.receiptFile);
        receiptBlobName = uploadResult.blobName;
      } catch (uploadError) {
        setExpenseStatus(`Could not upload photo: ${uploadError.message || "unknown error"}. Expense not saved.`);
        setSavingExpense(false);
        return false;
      }
    } else if (isFood && formValues.removeExistingReceipt) {
      receiptBlobName = null;
    }

    const payload = {
      tripSlug: selectedExpenseTrip.slug,
      category: formValues.category,
      amount,
      currency: selectedExpenseTrip.expenses?.baseCurrency || "EUR",
      date: formValues.date,
      description: formValues.description,
      rating: isFood && formValues.rating > 0 ? formValues.rating : null,
      receiptBlobName,
      photoLocation: isFood && receiptBlobName ? formValues.photoLocation || null : null
    };

    try {
      if (editingEntry) {
        const result = await updateExpenseEntry({ id: editingEntry.id, tripSlug: editingEntry.tripSlug, payload });
        if (result?.entry) {
          updateLiveEntry(result.entry);
        }
        setExpenseStatus("Expense updated.");
        setEditingEntry(null);
        return true;
      }

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
      await deleteExpenseEntry({ id: entry.id, tripSlug: entry.tripSlug, receiptBlobName: entry.receiptBlobName });
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
