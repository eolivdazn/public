/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { ExpenseForm } from "./ExpenseForm";

vi.mock("../lib/api.js", () => ({
  fetchAiSuggestionsStatus: vi.fn().mockResolvedValue(false),
  suggestFoodDescription: vi.fn()
}));

afterEach(() => {
  cleanup();
});

const trip = {
  slug: "test-trip",
  title: "🧪 Test Trip",
  expenses: { baseCurrency: "EUR", partySize: 2 }
};

function renderForm(overrides = {}) {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onChangeTripSlug = vi.fn();
  const onCancelEdit = vi.fn();

  render(
    <ExpenseForm
      trips={[trip]}
      selectedExpenseTripSlug={trip.slug}
      onChangeTripSlug={onChangeTripSlug}
      tripSelectDisabled={false}
      selectedExpenseTrip={trip}
      onSubmit={onSubmit}
      saving={false}
      status=""
      editingEntry={null}
      onCancelEdit={onCancelEdit}
      {...overrides}
    />
  );

  return { onSubmit, onChangeTripSlug, onCancelEdit };
}

describe("ExpenseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the photo and rating fields by default (category defaults to food)", () => {
    renderForm();
    expect(screen.getByText("Photos (optional)")).toBeTruthy();
    expect(screen.getByText("Rating (optional)")).toBeTruthy();
  });

  it("hides the photo and rating fields for non-food categories", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.selectOptions(screen.getByLabelText("Category"), "hotel");

    expect(screen.queryByText("Photos (optional)")).toBeNull();
    expect(screen.queryByText("Rating (optional)")).toBeNull();
  });

  it("submits the filled-in form values", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.selectOptions(screen.getByLabelText("Category"), "entertainment");
    await user.type(screen.getByPlaceholderText("0.00"), "42.5");
    await user.type(screen.getByPlaceholderText("Dinner, taxi, museum, coffee..."), "Museum tickets");
    await user.click(screen.getByRole("button", { name: "Save expense" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.category).toBe("entertainment");
    expect(submitted.amount).toBe("42.5");
    expect(submitted.description).toBe("Museum tickets");
    expect(submitted.photos).toEqual([]);
    expect(submitted.rating).toBe(0);
  });

  it("disables the submit button and shows 'Saving...' while saving", () => {
    renderForm({ saving: true });
    const button = screen.getByRole("button", { name: "Saving..." });
    expect(button.disabled).toBe(true);
  });

  it("disables submit when there's no selected trip", () => {
    renderForm({ selectedExpenseTrip: null });
    const button = screen.getByRole("button", { name: "Save expense" });
    expect(button.disabled).toBe(true);
    expect(screen.getByText("Select a trip to enable the form.")).toBeTruthy();
  });
});
