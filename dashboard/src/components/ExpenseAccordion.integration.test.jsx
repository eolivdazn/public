/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpenseAccordion } from "./ExpenseAccordion";
import { submitExpense } from "../lib/submitExpense.js";

vi.mock("../lib/api.js", () => ({
  fetchAiSuggestionsStatus: vi.fn().mockResolvedValue(false),
  suggestFoodDescription: vi.fn(),
  deleteExpenseEntry: vi.fn()
}));

vi.mock("../lib/submitExpense.js", () => ({
  submitExpense: vi.fn()
}));

afterEach(() => {
  cleanup();
});

const trip = {
  slug: "test-trip",
  title: "🧪 Test Trip",
  expenses: { baseCurrency: "EUR", partySize: 2 }
};

function renderAccordion(overrides = {}) {
  const addLiveEntry = vi.fn();
  const updateLiveEntry = vi.fn();
  const removeLiveEntry = vi.fn();

  render(
    <ExpenseAccordion
      trips={[trip]}
      selectedExpenseTripSlug={trip.slug}
      onChangeTripSlug={vi.fn()}
      tripSelectDisabled={false}
      selectedExpenseTrip={trip}
      snapshot={null}
      entries={[]}
      liveLoading={false}
      liveError=""
      addLiveEntry={addLiveEntry}
      updateLiveEntry={updateLiveEntry}
      removeLiveEntry={removeLiveEntry}
      {...overrides}
    />
  );

  return { addLiveEntry, updateLiveEntry, removeLiveEntry };
}

describe("ExpenseAccordion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts collapsed and reveals the form/live panel once opened", async () => {
    const user = userEvent.setup();
    renderAccordion();

    expect(screen.queryByText("Add expense")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Add \/ view expenses/ }));

    expect(screen.getByText("Add expense")).toBeTruthy();
    expect(screen.getByText("Live trip expenses")).toBeTruthy();
  });

  it("submits an expense end-to-end: fills the form, calls submitExpense, adds the live entry, and shows the success status", async () => {
    const user = userEvent.setup();
    const savedEntry = { id: "abc123", tripSlug: trip.slug, category: "food", amount: 12.5 };
    submitExpense.mockResolvedValue({ entry: savedEntry, message: "Expense saved.", isUpdate: false });

    const { addLiveEntry } = renderAccordion();

    await user.click(screen.getByRole("button", { name: /Add \/ view expenses/ }));
    await user.type(screen.getByPlaceholderText("0.00"), "12.5");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(submitExpense).toHaveBeenCalledTimes(1);
    const call = submitExpense.mock.calls[0][0];
    expect(call.trip).toEqual(trip);
    expect(call.formValues.amount).toBe("12.5");

    expect(addLiveEntry).toHaveBeenCalledWith(savedEntry);
    expect(await screen.findByText("Expense saved.")).toBeTruthy();
  });

  it("shows the returned error message and does not add a live entry when submitExpense rejects", async () => {
    const user = userEvent.setup();
    submitExpense.mockRejectedValue(new Error("Could not save expense."));

    const { addLiveEntry } = renderAccordion();

    await user.click(screen.getByRole("button", { name: /Add \/ view expenses/ }));
    // A valid amount is required to clear the native HTML5 "required" constraint on the field —
    // the rejection being tested here comes from submitExpense itself, not client-side validation.
    await user.type(screen.getByPlaceholderText("0.00"), "5");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(await screen.findByText("Could not save expense.")).toBeTruthy();
    expect(addLiveEntry).not.toHaveBeenCalled();
  });
});
