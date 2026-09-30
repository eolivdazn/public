import { gps, parse } from "exifr/dist/lite.esm.mjs";

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

// Calendar day the photo was taken ("YYYY-MM-DD"), from its own EXIF — never the device clock.
// EXIF times have no time zone: exifr turns them into a Date in local time, so the local
// year/month/day are the photo's wall-clock date. Must run on the original file: compression
// re-encodes the image and drops the EXIF data.
export function formatTakenOn(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export async function extractPhotoTakenOn(file, { parseExif = parse } = {}) {
  try {
    const result = await parseExif(file, { pick: ["DateTimeOriginal", "CreateDate"] });
    return formatTakenOn(result?.DateTimeOriginal) || formatTakenOn(result?.CreateDate);
  } catch {
    // No EXIF date in this photo (or unsupported format).
    return null;
  }
}
