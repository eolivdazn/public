export async function fetchExpenseEntries(tripSlug) {
  const url = tripSlug ? `/api/expenses?tripSlug=${encodeURIComponent(tripSlug)}` : "/api/expenses";
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Could not load live expenses (${response.status}).`);
  }

  return Array.isArray(payload?.entries) ? payload.entries : [];
}

export async function postExpenseEntry(payload) {
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Could not save expense (${response.status}).`);
  }

  return result;
}

export async function updateExpenseEntry({ id, tripSlug, payload }) {
  const params = new URLSearchParams({ id, tripSlug });
  const response = await fetch(`/api/expenses?${params.toString()}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Could not update expense (${response.status}).`);
  }

  return result;
}

export async function fetchAuditEntries({ tripSlug, page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams();
  if (tripSlug) {
    params.set("tripSlug", tripSlug);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const response = await fetch(`/api/audit?${params.toString()}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Could not load audit history (${response.status}).`);
  }

  return {
    entries: Array.isArray(payload?.entries) ? payload.entries : [],
    total: payload?.total || 0,
    page: payload?.page || page,
    pageSize: payload?.pageSize || pageSize,
    totalPages: payload?.totalPages || 1
  };
}

export async function deleteExpenseEntry({ id, tripSlug, receiptBlobName }) {
  const params = new URLSearchParams({ id, tripSlug });
  if (receiptBlobName) {
    params.set("receiptBlobName", receiptBlobName);
  }

  const response = await fetch(`/api/expenses?${params.toString()}`, {
    method: "DELETE"
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Could not delete expense (${response.status}).`);
  }

  return result;
}

export async function uploadReceipt(tripSlug, blob) {
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the image for upload."));
    reader.readAsDataURL(blob);
  });

  const response = await fetch(`/api/receipts?tripSlug=${encodeURIComponent(tripSlug)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ contentType: blob.type, data: base64Data })
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Could not upload receipt (${response.status}).`);
  }

  return result;
}
