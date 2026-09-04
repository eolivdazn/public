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

export async function fetchAuditEntries(tripSlug) {
  const url = tripSlug ? `/api/audit?tripSlug=${encodeURIComponent(tripSlug)}` : "/api/audit";
  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Could not load audit history (${response.status}).`);
  }

  return Array.isArray(payload?.entries) ? payload.entries : [];
}

export async function deleteExpenseEntry({ id, tripSlug }) {
  const response = await fetch(`/api/expenses?id=${encodeURIComponent(id)}&tripSlug=${encodeURIComponent(tripSlug)}`, {
    method: "DELETE"
  });
  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || `Could not delete expense (${response.status}).`);
  }

  return result;
}
