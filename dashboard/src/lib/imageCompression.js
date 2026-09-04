const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RECEIPT_FILE_BYTES = 15 * 1024 * 1024;

export function validateReceiptFile(file) {
  if (!file) {
    return { valid: false, error: "No file selected." };
  }
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
    return { valid: false, error: "Only JPEG, PNG or WEBP images are allowed." };
  }
  if (file.size > MAX_RECEIPT_FILE_BYTES) {
    return { valid: false, error: `Image must be smaller than ${MAX_RECEIPT_FILE_BYTES / (1024 * 1024)}MB.` };
  }
  return { valid: true, error: null };
}

export async function compressImage(file, { maxDimension = 1600, quality = 0.8 } = {}) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not compress the image."))),
      "image/jpeg",
      quality
    );
  });
}
