import { useEffect, useRef, useState } from "react";
import { FormField } from "./FormField";
import { StarRating } from "./StarRating";
import { EXPENSE_CATEGORY_OPTIONS } from "../lib/expenses.js";
import { validateReceiptFile, compressImage } from "../lib/imageCompression.js";
import { requestCurrentLocation } from "../lib/geolocation.js";
import { suggestFoodDescription, fetchAiSuggestionsStatus } from "../lib/api.js";

function defaultFormValues() {
  return {
    category: "food",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    rating: 0,
    receiptFile: null,
    receiptPreviewUrl: null,
    existingReceiptUrl: null,
    existingReceiptBlobName: null,
    removeExistingReceipt: false,
    photoLocation: null
  };
}

function formValuesFromEntry(entry) {
  if (!entry) {
    return defaultFormValues();
  }
  return {
    category: entry.category,
    amount: entry.amount === undefined || entry.amount === null ? "" : String(entry.amount),
    date: entry.date || new Date().toISOString().slice(0, 10),
    description: entry.description || "",
    rating: entry.rating || 0,
    receiptFile: null,
    receiptPreviewUrl: null,
    existingReceiptUrl: entry.receiptUrl || null,
    existingReceiptBlobName: entry.receiptBlobName || null,
    removeExistingReceipt: false,
    photoLocation: entry.photoLocation || null
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
  status,
  editingEntry,
  onCancelEdit
}) {
  const [expenseForm, setExpenseForm] = useState(() => formValuesFromEntry(editingEntry));
  const [receiptError, setReceiptError] = useState("");
  const [suggestingDescription, setSuggestingDescription] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [descriptionSuggestion, setDescriptionSuggestion] = useState(null);
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const fileInputRef = useRef(null);
  const isEditing = Boolean(editingEntry);

  useEffect(() => {
    fetchAiSuggestionsStatus().then(setAiSuggestionsEnabled);
  }, []);

  useEffect(() => {
    setExpenseForm(formValuesFromEntry(editingEntry));
    setReceiptError("");
    setSuggestionError("");
    setDescriptionSuggestion(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [editingEntry]);

  useEffect(() => {
    if (isEditing || !selectedExpenseTrip) {
      return;
    }
    setExpenseForm((current) => (current.date && current.category ? current : defaultFormValues()));
  }, [selectedExpenseTrip, isEditing]);

  function clearReceipt() {
    setExpenseForm((current) => {
      if (current.receiptPreviewUrl) {
        URL.revokeObjectURL(current.receiptPreviewUrl);
      }
      return { ...current, receiptFile: null, receiptPreviewUrl: null, removeExistingReceipt: true, photoLocation: null };
    });
    setReceiptError("");
    setSuggestionError("");
    setDescriptionSuggestion(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearLocation() {
    setExpenseForm((current) => ({ ...current, photoLocation: null }));
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      return;
    }

    const validation = validateReceiptFile(file);
    if (!validation.valid) {
      setReceiptError(validation.error);
      event.target.value = "";
      return;
    }

    setReceiptError("");
    setSuggestionError("");
    setDescriptionSuggestion(null);
    try {
      const compressed = await compressImage(file);
      setExpenseForm((current) => {
        if (current.receiptPreviewUrl) {
          URL.revokeObjectURL(current.receiptPreviewUrl);
        }
        return {
          ...current,
          receiptFile: compressed,
          receiptPreviewUrl: URL.createObjectURL(compressed),
          removeExistingReceipt: false,
          photoLocation: null
        };
      });
      const location = await requestCurrentLocation();
      if (location) {
        setExpenseForm((current) => ({ ...current, photoLocation: location }));
      }
    } catch (compressionError) {
      setReceiptError(compressionError.message || "Could not process the selected image.");
    }
  }

  async function handleSuggestDescription() {
    let sourceBlob = expenseForm.receiptFile;
    if (!sourceBlob && receiptPreviewUrl) {
      sourceBlob = await fetch(receiptPreviewUrl).then((response) => response.blob());
    }
    if (!sourceBlob) {
      return;
    }

    setSuggestingDescription(true);
    setSuggestionError("");
    try {
      const suggestion = await suggestFoodDescription(sourceBlob);
      setDescriptionSuggestion(suggestion);
    } catch (suggestError) {
      setSuggestionError(suggestError.message || "Could not get a suggestion.");
    } finally {
      setSuggestingDescription(false);
    }
  }

  function acceptDescriptionSuggestion() {
    setExpenseForm((current) => ({ ...current, description: descriptionSuggestion }));
    setDescriptionSuggestion(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const success = await onSubmit(expenseForm);
    if (!success) {
      return;
    }

    if (expenseForm.receiptPreviewUrl) {
      URL.revokeObjectURL(expenseForm.receiptPreviewUrl);
    }

    if (isEditing) {
      onCancelEdit();
      return;
    }

    setExpenseForm((current) => ({
      ...current,
      amount: "",
      description: "",
      date: new Date().toISOString().slice(0, 10),
      rating: 0,
      receiptFile: null,
      receiptPreviewUrl: null,
      photoLocation: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const receiptPreviewUrl = expenseForm.receiptPreviewUrl || (!expenseForm.removeExistingReceipt ? expenseForm.existingReceiptUrl : null);

  return (
    <article className="panel expense-form-panel">
      <div className="section-heading-row">
        <div>
          <h2>{isEditing ? "Edit expense" : "Add expense"}</h2>
          <p className="section-copy">
            {isEditing
              ? "Update the details below and save your changes."
              : "Log food and entertainment during the trip. Static flights and hotel stay in the markdown file."}
          </p>
        </div>
      </div>

      <form className="expense-form" onSubmit={handleSubmit}>
        <div className="expense-form-grid">
          <FormField label="Trip">
            <select
              value={selectedExpenseTripSlug || ""}
              disabled={tripSelectDisabled || isEditing}
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

        {expenseForm.category === "food" ? (
          <div className="expense-form-grid">
            <FormField label="Dish photo (optional)">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
              {receiptError ? <p className="status error">{receiptError}</p> : null}
              {receiptPreviewUrl ? (
                <div className="expense-receipt-preview">
                  <img src={receiptPreviewUrl} alt="Dish" className="expense-entry-receipt-thumb" />
                  <button type="button" onClick={clearReceipt}>
                    Remove photo
                  </button>
                </div>
              ) : null}
              {expenseForm.photoLocation ? (
                <p className="expense-photo-location">
                  📍 Location attached
                  <button type="button" onClick={clearLocation}>
                    Remove
                  </button>
                </p>
              ) : null}
              {receiptPreviewUrl && aiSuggestionsEnabled ? (
                <div className="expense-description-suggestion">
                  <button type="button" onClick={handleSuggestDescription} disabled={suggestingDescription}>
                    {suggestingDescription ? "Thinking..." : "✨ Suggest description"}
                  </button>
                  {suggestionError ? <p className="status error">{suggestionError}</p> : null}
                  {descriptionSuggestion ? (
                    <p className="expense-description-suggestion-result">
                      Suggestion: "{descriptionSuggestion}"
                      <button type="button" onClick={acceptDescriptionSuggestion}>
                        Use
                      </button>
                      <button type="button" onClick={() => setDescriptionSuggestion(null)}>
                        Dismiss
                      </button>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </FormField>

            <FormField label="Rating (optional)">
              <StarRating value={expenseForm.rating} onChange={(rating) => setExpenseForm((current) => ({ ...current, rating }))} />
            </FormField>
          </div>
        ) : null}

        <div className="expense-form-actions">
          <button type="submit" disabled={!selectedExpenseTrip || saving}>
            {saving ? "Saving..." : isEditing ? "Save changes" : "Save expense"}
          </button>
          {isEditing ? (
            <button type="button" className="expense-form-cancel" onClick={onCancelEdit} disabled={saving}>
              Cancel
            </button>
          ) : null}
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
