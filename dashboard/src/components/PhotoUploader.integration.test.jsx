/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhotoUploader } from "./PhotoUploader";
import { AuditEntryRow } from "./AuditEntryRow";
import { uploadReceipt, postTripPhoto } from "../lib/api.js";
import { extractPhotoLocation, extractPhotoTakenOn } from "../lib/geolocation.js";

vi.mock("../lib/api.js", () => ({ uploadReceipt: vi.fn(), postTripPhoto: vi.fn() }));
vi.mock("../lib/geolocation.js", () => ({ extractPhotoLocation: vi.fn(), extractPhotoTakenOn: vi.fn() }));
vi.mock("../lib/imageCompression.js", () => ({
  validateReceiptFile: (file) => (file.type.startsWith("image/") ? { valid: true } : { valid: false, error: "Only images." }),
  compressImage: async (file) => new Blob([file.name], { type: "image/jpeg" })
}));

const trip = { slug: "valencia2026", title: "Valencia" };
const photo = (name) => new File(["x"], name, { type: "image/jpeg" });

function selectPhotos(files) {
  fireEvent.change(screen.getByTestId("photo-gallery-input"), { target: { files } });
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  // First photo has EXIF date + GPS, second has neither.
  extractPhotoTakenOn.mockImplementation(async (file) => (file.name === "beach.jpg" ? "2026-10-17" : null));
  extractPhotoLocation.mockImplementation(async (file) => (file.name === "beach.jpg" ? { latitude: 39.47, longitude: -0.32 } : null));
  uploadReceipt.mockImplementation(async (tripSlug, blob) => ({ blobName: `${tripSlug}/${Math.random().toString(16).slice(2)}.jpg` }));
  postTripPhoto.mockResolvedValue({ photo: {} });
});

afterEach(() => cleanup());

describe("PhotoUploader", () => {
  it("lists the selected photos with their EXIF date/place and enables the upload", async () => {
    render(<PhotoUploader trip={trip} />);
    expect(screen.getByRole("button", { name: "Upload photos" }).disabled).toBe(true);

    selectPhotos([photo("beach.jpg"), photo("street.jpg")]);

    expect(await screen.findByRole("button", { name: "Upload 2 photos" })).toBeTruthy();
    expect(screen.getAllByLabelText("Caption (optional)")).toHaveLength(2);
    expect(screen.getByText("17 Oct")).toBeTruthy();
    expect(screen.getByText("Location")).toBeTruthy();
    expect(screen.getByText("No date or place in this photo")).toBeTruthy();
  });

  it("uploads each photo with its caption, date and place, then tells the gallery to refresh", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    window.addEventListener("trip-photos:changed", onChanged);
    render(<PhotoUploader trip={trip} />);
    selectPhotos([photo("beach.jpg"), photo("street.jpg")]);
    const [firstCaption] = await screen.findAllByLabelText("Caption (optional)");
    await user.type(firstCaption, "Sunset at Malvarrosa");

    await user.click(screen.getByRole("button", { name: "Upload 2 photos" }));

    expect(await screen.findByText("2 photos added.")).toBeTruthy();
    expect(uploadReceipt).toHaveBeenCalledTimes(2);
    expect(postTripPhoto).toHaveBeenNthCalledWith(1, {
      tripSlug: "valencia2026",
      blobName: expect.stringMatching(/^valencia2026\//),
      caption: "Sunset at Malvarrosa",
      takenOn: "2026-10-17",
      location: { latitude: 39.47, longitude: -0.32 }
    });
    expect(postTripPhoto).toHaveBeenNthCalledWith(2, {
      tripSlug: "valencia2026",
      blobName: expect.stringMatching(/^valencia2026\//),
      caption: undefined,
      takenOn: undefined,
      location: undefined
    });
    expect(screen.queryByLabelText("Caption (optional)")).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged.mock.calls[0][0].detail).toEqual({ tripSlug: "valencia2026" });
    window.removeEventListener("trip-photos:changed", onChanged);
  });

  it("keeps a failed photo with its error so it can be retried", async () => {
    const user = userEvent.setup();
    postTripPhoto.mockResolvedValueOnce({ photo: {} }).mockRejectedValueOnce(new Error("Photo already belongs to another expense or photo."));
    render(<PhotoUploader trip={trip} />);
    selectPhotos([photo("beach.jpg"), photo("street.jpg")]);

    await user.click(await screen.findByRole("button", { name: "Upload 2 photos" }));

    expect(await screen.findByText("1 photo added, 1 failed. Check the photos below and try again.")).toBeTruthy();
    expect(screen.getByText("Photo already belongs to another expense or photo.")).toBeTruthy();
    expect(screen.getAllByLabelText("Caption (optional)")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Retry 1 photo" })).toBeTruthy();
  });

  it("removes a photo from the selection before uploading", async () => {
    const user = userEvent.setup();
    render(<PhotoUploader trip={trip} />);
    selectPhotos([photo("beach.jpg"), photo("street.jpg")]);
    await screen.findByRole("button", { name: "Upload 2 photos" });

    await user.click(screen.getByRole("button", { name: "Remove photo 1 from the selection" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Upload 1 photo" })).toBeTruthy());
    expect(uploadReceipt).not.toHaveBeenCalled();
  });
});

describe("AuditEntryRow", () => {
  it("labels photo records as trip photos and keeps expense records as they were", () => {
    render(
      <ul>
        <AuditEntryRow entry={{ id: "a1", action: "create", kind: "photo", photoId: "p1", expenseId: null, tripSlug: "valencia2026", at: "2026-10-17T10:00:00Z" }} />
        <AuditEntryRow entry={{ id: "a2", action: "delete", expenseId: "e9", tripSlug: "valencia2026", at: "2026-10-17T11:00:00Z" }} />
      </ul>
    );
    expect(screen.getByText("trip photo")).toBeTruthy();
    expect(screen.getByText("expense e9")).toBeTruthy();
  });
});
