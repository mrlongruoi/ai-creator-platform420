// Helper to build ImageKit transformation URLs
/**
 * Build an ImageKit URL with transformation parameters.
 * This function keeps branching minimal by delegating to tiny helpers.
 *
 * @param {string} src - The original ImageKit URL
 * @param {Array<object>} transformations - Array of transformation configs
 * @returns {string} URL with /tr: parameters applied
 */
export const buildTransformationUrl = (src, transformations = []) => {
  if (typeof src !== "string" || !src) return src;
  if (!Array.isArray(transformations) || transformations.length === 0) {
    return src;
  }

  const transformParams = transformations
    .filter(Boolean)
    .map((t) => buildSingleTransform(t))
    .filter((p) => p && p.length > 0)
    .join(":");

  if (!transformParams) return src;

  // Insert transformation parameters into URL
  if (src.includes("/tr:")) {
    // Already has transformations, append to existing
    return src.replace("/tr:", `/tr:${transformParams}:`);
  }

  // Add new transformations before the filename segment
  const [path, query = ""] = src.split("?");
  const urlParts = path.split("/");
  const fileIndex = urlParts.length - 1;
  urlParts.splice(fileIndex, 0, `tr:${transformParams}`);
  const built = urlParts.join("/");
  return query ? `${built}?${query}` : built;
};

function buildSingleTransform(transform) {
  // If this is an overlay-only transform, return layer string immediately
  const layer = buildOverlayLayer(transform);
  if (layer) return layer;

  const resize = buildResizePieces(transform);
  const effects = buildEffectPieces(transform);
  const background = buildBackgroundPieces(transform);
  return [...resize, ...effects, ...background].filter(Boolean).join(",");
}

function buildResizePieces(t) {
  const out = [];
  if (t?.width) out.push(`w-${t.width}`);
  if (t?.height) out.push(`h-${t.height}`);
  if (t?.focus) out.push(`fo-${t.focus}`);
  if (t?.cropMode) out.push(`cm-${t.cropMode}`);
  return out;
}

function buildEffectPieces(t) {
  return t?.effect ? [`e-${t.effect}`] : [];
}

function buildBackgroundPieces(t) {
  return t?.background ? [`bg-${t.background}`] : [];
}

function buildOverlayLayer(t) {
  if (!t?.overlayText) return "";
  const layerParams = [
    "l-text",
    `i-${encodeURIComponent(t.overlayText)}`,
    "tg-bold",
    "lx-20,ly-20",
  ];

  if (t.overlayTextFontSize) layerParams.push(`fs-${t.overlayTextFontSize}`);
  if (t.overlayTextColor) layerParams.push(`co-${t.overlayTextColor}`);
  if (t.gravity) {
    const gravityMap = {
      center: "center",
      north_west: "top_left",
      north_east: "top_right",
      south_west: "bottom_left",
      south_east: "bottom_right",
      north: "top",
      south: "bottom",
      west: "left",
      east: "right",
    };
    const mapped = gravityMap[t.gravity] || t.gravity;
    layerParams.push(`lfo-${mapped}`);
  }
  if (t.overlayTextPadding) layerParams.push(`pa-${t.overlayTextPadding}`);
  if (t.overlayBackground) layerParams.push(`bg-${t.overlayBackground}`);

  layerParams.push("l-end");
  return layerParams.join(",");
}

// Upload file to ImageKit using your server-side API
export const uploadToImageKit = async (file, fileName) => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", fileName);

    const response = await fetch("/api/imagekit/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Upload failed");
    }

    const result = await response.json();

    return {
      success: true,
      data: {
        fileId: result.fileId,
        name: result.name,
        url: result.url,
        width: result.width,
        height: result.height,
        size: result.size,
      },
    };
  } catch (error) {
    console.error("ImageKit upload error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
