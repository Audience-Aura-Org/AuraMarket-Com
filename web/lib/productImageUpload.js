"use client";

export const MAX_PRODUCT_IMAGES = 5;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_MAX_WIDTH = 1600;

const canvasToBlob = (canvas, type = "image/webp", quality = 0.82) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality));

const loadImageSource = async (file) => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read selected image."));
      img.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

export const optimizeProductImage = async (file) => {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Select image files from your gallery.");
  }
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

  try {
    const source = await loadImageSource(file);
    const sourceWidth = source.width || source.videoWidth || 1;
    const sourceHeight = source.height || source.videoHeight || 1;
    const scale = Math.min(1, PRODUCT_IMAGE_MAX_WIDTH / Math.max(sourceWidth, 1));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d", { alpha: false }).drawImage(source, 0, 0, width, height);
    source.close?.();

    const baseName = (file.name || "product-image").replace(/\.[^.]+$/, "");
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      if (blob && blob.size < file.size && blob.size <= PRODUCT_IMAGE_MAX_BYTES) {
        return new File([blob], `${baseName}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        });
      }
    }

    return file;
  } catch (err) {
    console.warn("[ProductUpload] Image optimization skipped:", err.message || err);
    return file;
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result || "");
    reader.onerror = () => reject(new Error("Could not prepare selected images."));
    reader.readAsDataURL(file);
  });

export const prepareProductImageEntries = async (files, extra = {}) => {
  const optimized = await Promise.all(files.map(optimizeProductImage));
  const tooLarge = optimized.find((file) => file.size > PRODUCT_IMAGE_MAX_BYTES);
  if (tooLarge) {
    throw new Error("One selected image is still over 5MB. Please choose a smaller image.");
  }

  return Promise.all(
    optimized.map(async (file) => ({
      ...extra,
      file,
      url: await readFileAsDataUrl(file),
    }))
  );
};
