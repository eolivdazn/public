import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { validateReceiptFile, compressImage } from "../lib/imageCompression.js";
import { extractPhotoLocation, extractPhotoTakenOn } from "../lib/geolocation.js";
import { uploadReceipt, postTripPhoto } from "../lib/api.js";

const MAX_PHOTOS_PER_BATCH = 20;
const MAX_CAPTION_LENGTH = 200;

const dayLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function formatDay(isoDate) {
  return isoDate ? dayLabel.format(new Date(`${isoDate}T00:00:00Z`)) : "";
}

// Adds photos to a trip (not tied to an expense): pick several, give each an optional caption,
// upload them one by one. Date and location come from each photo's own EXIF data, read before
// compression strips it. After a successful upload the trip page's gallery is told to refresh
// through a "trip-photos:changed" window event.
export function PhotoUploader({ trip }) {
  const [items, setItems] = useState([]);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [selectError, setSelectError] = useState("");
  const [status, setStatus] = useState("");
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Free the preview URLs when the component goes away.
  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    []
  );

  function updateItem(localId, changes) {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...changes } : item)));
  }

  function removeItem(localId) {
    setItems((current) => {
      const item = current.find((entry) => entry.localId === localId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((entry) => entry.localId !== localId);
    });
  }

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    setSelectError("");
    setStatus("");
    const room = MAX_PHOTOS_PER_BATCH - itemsRef.current.length;
    const accepted = files.slice(0, Math.max(room, 0));
    if (files.length > accepted.length) {
      setSelectError(`You can add up to ${MAX_PHOTOS_PER_BATCH} photos at a time. Some photos were not added.`);
    }

    setPreparing(true);
    for (const file of accepted) {
      const validation = validateReceiptFile(file);
      if (!validation.valid) {
        setSelectError(validation.error);
        continue;
      }
      try {
        // EXIF first: compression re-encodes the image and drops it.
        const [location, takenOn] = await Promise.all([extractPhotoLocation(file), extractPhotoTakenOn(file)]);
        const compressed = await compressImage(file);
        const item = {
          localId: crypto.randomUUID(),
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
          caption: "",
          takenOn,
          location,
          state: "ready",
          error: ""
        };
        setItems((current) => [...current, item]);
      } catch (error) {
        setSelectError(error.message || "Could not process the selected image.");
      }
    }
    setPreparing(false);
  }

  async function handleUpload() {
    const pending = itemsRef.current.filter((item) => item.state !== "done");
    if (pending.length === 0) {
      return;
    }

    setUploading(true);
    setStatus("");
    let added = 0;
    for (const [index, item] of pending.entries()) {
      setProgress({ current: index + 1, total: pending.length });
      updateItem(item.localId, { state: "uploading", error: "" });
      try {
        const { blobName } = await uploadReceipt(trip.slug, item.file);
        await postTripPhoto({
          tripSlug: trip.slug,
          blobName,
          caption: item.caption.trim() || undefined,
          takenOn: item.takenOn || undefined,
          location: item.location || undefined
        });
        added += 1;
        updateItem(item.localId, { state: "done" });
      } catch (error) {
        updateItem(item.localId, { state: "error", error: error.message || "Could not upload this photo." });
      }
    }
    setProgress(null);
    setUploading(false);

    // Uploaded photos leave the list; failed ones stay so they can be retried.
    setItems((current) => {
      current.filter((item) => item.state === "done").forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return current.filter((item) => item.state !== "done");
    });

    const failed = pending.length - added;
    const addedText = `${added} photo${added === 1 ? "" : "s"} added`;
    setStatus(failed > 0 ? `${addedText}, ${failed} failed. Check the photos below and try again.` : `${addedText}.`);
    if (added > 0) {
      window.dispatchEvent(new CustomEvent("trip-photos:changed", { detail: { tripSlug: trip.slug } }));
    }
  }

  const retrying = items.some((item) => item.state === "error");
  const uploadLabel = uploading
    ? `Uploading ${progress ? `${progress.current} / ${progress.total}` : ""}…`
    : retrying
      ? `Retry ${items.length} photo${items.length === 1 ? "" : "s"}`
      : `Upload ${items.length} photo${items.length === 1 ? "" : "s"}`;

  return (
    <div className="photo-uploader">
      {/* Kept outside any <label>: WebKit forwards clicks inside a label to a nested file input. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilesSelected}
        style={{ display: "none" }}
        data-testid="photo-camera-input"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        style={{ display: "none" }}
        data-testid="photo-gallery-input"
      />

      <p className="section-copy">
        Landscapes, people, moments. The date and place are read from each photo, when it has them.
      </p>

      <div className="expense-photo-add-buttons">
        <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
          <Icon name="camera" size={18} />
          Take photo
        </button>
        <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={uploading}>
          <Icon name="image" size={18} />
          Choose from gallery
        </button>
      </div>

      {preparing ? (
        <p className="muted-text" role="status">
          Preparing photos…
        </p>
      ) : null}
      {selectError ? (
        <p className="status error" role="alert">
          {selectError}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="photo-uploader-list" aria-label="Photos to upload">
          {items.map((item, index) => {
            const captionId = `photo-caption-${item.localId}`;
            const errorId = `photo-error-${item.localId}`;
            return (
              <li key={item.localId} className={`photo-uploader-item is-${item.state}`}>
                <img src={item.previewUrl} alt={`Selected photo ${index + 1}`} className="photo-uploader-thumb" width="72" height="72" />
                <div className="photo-uploader-fields">
                  <label className="photo-uploader-caption" htmlFor={captionId}>
                    Caption (optional)
                  </label>
                  <input
                    id={captionId}
                    type="text"
                    value={item.caption}
                    maxLength={MAX_CAPTION_LENGTH}
                    placeholder="Sunset at the beach"
                    disabled={uploading}
                    aria-describedby={item.error ? errorId : undefined}
                    onChange={(event) => updateItem(item.localId, { caption: event.target.value })}
                  />
                  <p className="photo-uploader-meta">
                    {item.takenOn ? (
                      <span>
                        <Icon name="calendar" size={14} />
                        {formatDay(item.takenOn)}
                      </span>
                    ) : null}
                    {item.location ? (
                      <span>
                        <Icon name="mapPin" size={14} />
                        Location
                      </span>
                    ) : null}
                    {!item.takenOn && !item.location ? <span>No date or place in this photo</span> : null}
                    {item.state === "uploading" ? <span>Uploading…</span> : null}
                  </p>
                  {item.error ? (
                    <p className="status error" id={errorId}>
                      {item.error}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="photo-uploader-remove"
                  aria-label={`Remove photo ${index + 1} from the selection`}
                  disabled={uploading}
                  onClick={() => removeItem(item.localId)}
                >
                  <Icon name="x" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="expense-form-actions">
        <button type="button" className="btn btn-primary" disabled={items.length === 0 || uploading || preparing} onClick={handleUpload}>
          {items.length === 0 ? "Upload photos" : uploadLabel}
        </button>
      </div>

      <p className="status success" role="status">
        {status}
      </p>
    </div>
  );
}
