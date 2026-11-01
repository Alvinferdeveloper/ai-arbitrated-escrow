import exifr from "exifr";
import { EVIDENCE_MAX_LONG_SIDE_PX } from "@/lib/config";

// Browser only: resizing strips EXIF, so it is read from the original first.

export type PreparedPhoto = {
  blob: Blob;
  width: number;
  height: number;
  exif: Record<string, string | number | boolean | null>;
};

const EXIF_TAGS = ["Make", "Model", "Software", "DateTimeOriginal", "Orientation"];

async function readExif(file: File): Promise<PreparedPhoto["exif"]> {
  const summary: PreparedPhoto["exif"] = {
    originalName: file.name.slice(0, 120),
    originalBytes: file.size,
    originalType: file.type || null,
  };

  try {
    const tags = await exifr.parse(file, { pick: [...EXIF_TAGS, "latitude", "longitude"] });
    if (!tags) return { ...summary, hasExif: false };

    for (const tag of EXIF_TAGS) {
      const value: unknown = tags[tag];
      if (value instanceof Date) summary[tag] = value.toISOString();
      else if (typeof value === "string") summary[tag] = value.slice(0, 200);
      else if (typeof value === "number") summary[tag] = value;
    }

    return {
      ...summary,
      hasExif: true,
      hasGps: typeof tags.latitude === "number" && typeof tags.longitude === "number",
    };
  } catch {
    return { ...summary, hasExif: false };
  }
}

async function resize(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, EVIDENCE_MAX_LONG_SIDE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot resize photos.");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("The photo could not be converted.");

  return { blob, width, height };
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const [exif, resized] = await Promise.all([readExif(file), resize(file)]);
  return { ...resized, exif };
}
