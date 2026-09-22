import { uploadReceipt, postExpenseEntry, updateExpenseEntry } from "./api.js";

export async function submitExpense({ trip, formValues, editingEntry = null }) {
  if (!trip) {
    throw new Error("Select a trip first.");
  }

  const amount = Number(formValues.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }

  const isFood = formValues.category === "food";

  let photos = [];
  if (isFood) {
    try {
      photos = await Promise.all(
        formValues.photos.map(async (photo) => {
          if (photo.file) {
            const uploadResult = await uploadReceipt(trip.slug, photo.file);
            return { blobName: uploadResult.blobName };
          }
          return { blobName: photo.existingBlobName };
        })
      );
    } catch (uploadError) {
      throw new Error(`Could not upload photo: ${uploadError.message || "unknown error"}. Expense not saved.`);
    }
  }

  const payload = {
    tripSlug: trip.slug,
    category: formValues.category,
    amount,
    currency: trip.expenses?.baseCurrency || "EUR",
    date: formValues.date,
    description: formValues.description,
    rating: isFood && formValues.rating > 0 ? formValues.rating : null,
    location: isFood ? formValues.location || null : null,
    photos
  };

  if (editingEntry) {
    const result = await updateExpenseEntry({ id: editingEntry.id, tripSlug: editingEntry.tripSlug, payload });
    return { entry: result?.entry || null, message: "Expense updated.", isUpdate: true };
  }

  const result = await postExpenseEntry(payload);
  return { entry: result?.entry || null, message: "Expense saved.", isUpdate: false };
}
