import { gps } from "exifr/dist/lite.esm.mjs";

export async function extractPhotoLocation(file) {
  try {
    const result = await gps(file);
    if (result && Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) {
      return { latitude: result.latitude, longitude: result.longitude };
    }
  } catch {
    // No EXIF GPS in this photo (or unsupported format) — no location available.
  }
  return null;
}
