import { useEffect, useRef, useState } from "react";
import { FormField } from "./FormField";
import { StarRating } from "./StarRating";
import { EXPENSE_CATEGORY_OPTIONS, MAX_PHOTOS_PER_EXPENSE } from "../lib/expenses.js";
import { validateReceiptFile, compressImage } from "../lib/imageCompression.js";
import { extractPhotoLocation } from "../lib/geolocation.js";
import { suggestFoodDescription, fetchAiSuggestionsStatus } from "../lib/api.js";

function defaultFormValues() {
  return {
    category: "food",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    rating: 0,
    location: null,
    photos: []
  };
}

function photoFromEntryPhoto(photo) {
  return {
    localId: crypto.randomUUID(),
    file: null,
    previewUrl: photo.url || null,
    existingBlobName: photo.blobName,
    suggesting: false,
    suggestionError: "",
    suggestion: null
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
    location: entry.location || null,
    photos: (entry.photos || []).map(photoFromEntryPhoto)
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
  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const isEditing = Boolean(editingEntry);

  useEffect(() => {
    fetchAiSuggestionsStatus().then(setAiSuggestionsEnabled);
  }, []);

  useEffect(() => {
    setExpenseForm(formValuesFromEntry(editingEntry));
    setReceiptError("");
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  }, [editingEntry]);

  useEffect(() => {
    if (isEditing || !selectedExpenseTrip) {
      return;
    }
    setExpenseForm((current) => (current.date && current.category ? current : defaultFormValues()));
  }, [selectedExpenseTrip, isEditing]);

  function removePhoto(localId) {
    setExpenseForm((current) => {
      const photo = current.photos.find((item) => item.localId === localId);
      if (photo?.file && photo.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return { ...current, photos: current.photos.filter((item) => item.localId !== localId) };
    });
  }

  function clearLocation() {
    setExpenseForm((current) => ({ ...current, location: null }));
  }

  async function handlePhotosSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setReceiptError("");
    const remainingSlots = MAX_PHOTOS_PER_EXPENSE - expenseForm.photos.length;
    const accepted = files.slice(0, Math.max(remainingSlots, 0));
    if (files.length > accepted.length) {
      setReceiptError(`Maximum ${MAX_PHOTOS_PER_EXPENSE} photos reached. Some photos were not added.`);
    }

    let needsLocation = !expenseForm.location;

    for (const file of accepted) {
      const validation = validateReceiptFile(file);
      if (!validation.valid) {
        setReceiptError(validation.error);
        continue;
      }

      let location = null;
      if (needsLocation) {
        location = await extractPhotoLocation(file);
        if (location) {
          needsLocation = false;
        }
      }

      try {
        const compressed = await compressImage(file);
        const previewUrl = URL.createObjectURL(compressed);
        const localId = crypto.randomUUID();
        setExpenseForm((current) => ({
          ...current,
          location: current.location || location,
          photos: [
            ...current.photos,
            {
              localId,
              file: compressed,
              previewUrl,
              existingBlobName: null,
              suggesting: false,
              suggestionError: "",
              suggestion: null
            }
          ]
        }));
      } catch (compressionError) {
        setReceiptError(compressionError.message || "Could not process the selected image.");
      }
    }
  }

  async function handleSuggestDescription(localId) {
    const photo = expenseForm.photos.find((item) => item.localId === localId);
    if (!photo) {
      return;
    }
    let sourceBlob = photo.file;
    if (!sourceBlob && photo.previewUrl) {
      sourceBlob = await fetch(photo.previewUrl).then((response) => response.blob());
    }
    if (!sourceBlob) {
      return;
    }

    setExpenseForm((current) => ({
      ...current,
      photos: current.photos.map((item) => (item.localId === localId ? { ...item, suggesting: true, suggestionError: "" } : item))
    }));
    try {
      const suggestion = await suggestFoodDescription(sourceBlob);
      setExpenseForm((current) => ({
        ...current,
        photos: current.photos.map((item) => (item.localId === localId ? { ...item, suggesting: false, suggestion } : item))
      }));
    } catch (suggestError) {
      setExpenseForm((current) => ({
        ...current,
        photos: current.photos.map((item) =>
          item.localId === localId
            ? { ...item, suggesting: false, suggestionError: suggestError.message || "Could not get a suggestion." }
            : item
        )
      }));
    }
  }

  function acceptDescriptionSuggestion(localId) {
    setExpenseForm((current) => {
      const photo = current.photos.find((item) => item.localId === localId);
      if (!photo?.suggestion) {
        return current;
      }
      return {
        ...current,
        description: current.description ? `${current.description}, ${photo.suggestion}` : photo.suggestion,
        photos: current.photos.map((item) => (item.localId === localId ? { ...item, suggestion: null } : item))
      };
    });
  }

  function dismissDescriptionSuggestion(localId) {
    setExpenseForm((current) => ({
      ...current,
      photos: current.photos.map((item) => (item.localId === localId ? { ...item, suggestion: null } : item))
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const success = await onSubmit(expenseForm);
    if (!success) {
      return;
    }

    for (const photo of expenseForm.photos) {
      if (photo.file && photo.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }
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
      location: null,
      photos: []
    }));
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = "";
    }
  }

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
            {/*
              These inputs live outside FormField's <label> on purpose: a click anywhere inside a
              <label> implicitly activates the first form control nested in it (native browser
              behavior). With these inputs nested inside the "Photos" label, tapping any button in
              the photo gallery (e.g. "Use" on a suggestion) also fired the hidden camera input on
              iOS Chrome, unexpectedly opening the camera. Keeping them as siblings avoids that.
            */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotosSelected}
              style={{ display: "none" }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotosSelected}
              style={{ display: "none" }}
            />
            <FormField label="Photos (optional)">
              {receiptError ? <p className="status error">{receiptError}</p> : null}

              {expenseForm.location ? (
                <p className="expense-photo-location">
                  📍 Location attached
                  <button type="button" onClick={clearLocation}>
                    Remove
                  </button>
                </p>
              ) : null}

              {expenseForm.photos.length > 0 ? (
                <div className="expense-photo-gallery">
                  {expenseForm.photos.map((photo) => (
                    <div className="expense-photo-card" key={photo.localId}>
                      <img src={photo.previewUrl} alt="Dish" className="expense-entry-receipt-thumb" />
                      <button type="button" onClick={() => removePhoto(photo.localId)}>
                        Remove
                      </button>
                      {aiSuggestionsEnabled ? (
                        <div className="expense-description-suggestion">
                          <button
                            type="button"
                            onClick={() => handleSuggestDescription(photo.localId)}
                            disabled={photo.suggesting}
                          >
                            {photo.suggesting ? "Thinking..." : "✨ Description"}
                          </button>
                          {photo.suggestionError ? <p className="status error">{photo.suggestionError}</p> : null}
                          {photo.suggestion ? (
                            <p className="expense-description-suggestion-result">
                              Suggestion: "{photo.suggestion}"
                              <button type="button" onClick={() => acceptDescriptionSuggestion(photo.localId)}>
                                Use
                              </button>
                              <button type="button" onClick={() => dismissDescriptionSuggestion(photo.localId)}>
                                Dismiss
                              </button>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {expenseForm.photos.length < MAX_PHOTOS_PER_EXPENSE ? (
                <div className="expense-photo-add-buttons">
                  <button type="button" onClick={() => cameraInputRef.current?.click()}>
                    📷 Take photo
                  </button>
                  <button type="button" onClick={() => galleryInputRef.current?.click()}>
                    🖼️ Choose from gallery
                  </button>
                </div>
              ) : (
                <p className="expense-muted">Maximum {MAX_PHOTOS_PER_EXPENSE} photos reached.</p>
              )}
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
