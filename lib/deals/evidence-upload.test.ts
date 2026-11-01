import { describe, expect, it } from "vitest";
import {
  disputeReasonSchema,
  evidenceUploadMetadataSchema,
  extensionFor,
  sniffImageType,
  unboxingUploadMetadataSchema,
} from "./evidence-upload";

const photo = { width: 1536, height: 1152, exif: { Make: "Pixel", hasGps: false } };
const ascii = (text: string) => new TextEncoder().encode(text);

describe("evidence upload boundary", () => {
  it("recognises JPEG, PNG and WebP by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(sniffImageType(ascii("RIFFxxxxWEBPVP8 "))).toBe("image/webp");
  });

  it("rejects anything else, whatever its name says", () => {
    expect(sniffImageType(ascii("<svg xmlns="))).toBeNull();
    expect(sniffImageType(ascii("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });

  it("maps media types to file extensions", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/png")).toBe("png");
    expect(extensionFor("image/webp")).toBe("webp");
  });

  it("needs metadata for all three photos", () => {
    expect(
      evidenceUploadMetadataSchema.safeParse({ A: photo, B: photo, C: photo }).success,
    ).toBe(true);
    expect(evidenceUploadMetadataSchema.safeParse({ A: photo, B: photo }).success).toBe(
      false,
    );
  });

  it("refuses nested or oversized EXIF", () => {
    const nested = { ...photo, exif: { GPS: { lat: 12.1 } } };
    expect(
      evidenceUploadMetadataSchema.safeParse({ A: nested, B: photo, C: photo }).success,
    ).toBe(false);

    const huge = {
      ...photo,
      exif: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`k${i}`, i])),
    };
    expect(
      evidenceUploadMetadataSchema.safeParse({ A: huge, B: photo, C: photo }).success,
    ).toBe(false);
  });

  it("accepts exactly one unboxing photo and a non-empty reason", () => {
    expect(unboxingUploadMetadataSchema.safeParse({ D: photo }).success).toBe(true);
    expect(unboxingUploadMetadataSchema.safeParse({ D: photo, A: photo }).success).toBe(false);
    expect(disputeReasonSchema.safeParse("  ").success).toBe(false);
    expect(disputeReasonSchema.safeParse("The box was empty.").success).toBe(true);
  });
});
