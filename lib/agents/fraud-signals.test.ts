import { describe, expect, it } from "vitest";
import {
  codeMatches,
  guidePredatesDeal,
  isEditedPhoto,
  isOldPhoto,
  trackingFitsCarrier,
} from "./fraud-signals";

const DEAL_CREATED = new Date("2026-11-03T15:00:00Z");

describe("codeMatches", () => {
  it("accepts the code regardless of case, spaces and dashes", () => {
    expect(codeMatches("k7p4", "K7P4")).toBe(true);
    expect(codeMatches("K7-P4", "K7P4")).toBe(true);
    expect(codeMatches(" K 7 P 4 ", "K7P4")).toBe(true);
  });

  it("accepts handwriting lookalikes such as an open 4 read as H", () => {
    expect(codeMatches("K7PH", "K7P4")).toBe(true);
    expect(codeMatches("K7PL", "K7P4")).toBe(true);
    expect(codeMatches("K7PU", "K7P4")).toBe(true);
    expect(codeMatches("BZS6", "825G")).toBe(true);
  });

  it("rejects a missing or different code", () => {
    expect(codeMatches(null, "K7P4")).toBe(false);
    expect(codeMatches("K7P5", "K7P4")).toBe(false);
    expect(codeMatches("K7P4", "")).toBe(false);
  });
});

describe("guidePredatesDeal", () => {
  it("flags a guide printed days before the deal", () => {
    expect(guidePredatesDeal("2026-10-28", DEAL_CREATED)).toBe(true);
  });

  it("allows the same day and the day before for time zones", () => {
    expect(guidePredatesDeal("2026-11-03", DEAL_CREATED)).toBe(false);
    expect(guidePredatesDeal("2026-11-02", DEAL_CREATED)).toBe(false);
    expect(guidePredatesDeal("2026-11-01", DEAL_CREATED)).toBe(true);
  });

  it("ignores a missing or invalid date", () => {
    expect(guidePredatesDeal(null, DEAL_CREATED)).toBe(false);
    expect(guidePredatesDeal("2026-13-45", DEAL_CREATED)).toBe(false);
  });
});

describe("trackingFitsCarrier", () => {
  it.each([
    ["UPS", "1Z999AA10123456784"],
    ["USPS", "9400 1000 0000 0000 0000 00"],
    ["FedEx", "123456789012"],
    ["DHL Express", "1234567890"],
    ["Cargo Expreso", "anything-goes"],
  ])("accepts %s %s", (carrier, tracking) => {
    expect(trackingFitsCarrier(carrier, tracking)).toBe(true);
  });

  it.each([
    ["UPS", "123456"],
    ["FedEx", "1Z999AA10123456784"],
    ["DHL", "ABC"],
  ])("rejects %s %s", (carrier, tracking) => {
    expect(trackingFitsCarrier(carrier, tracking)).toBe(false);
  });

  it("leaves a missing field to the unreadable guide rule", () => {
    expect(trackingFitsCarrier(null, "123")).toBe(true);
    expect(trackingFitsCarrier("UPS", null)).toBe(true);
  });
});

describe("photo metadata", () => {
  it("detects editing software and ignores cameras or missing EXIF", () => {
    expect(isEditedPhoto({ Software: "Adobe Photoshop 25.0" })).toBe(true);
    expect(isEditedPhoto({ Software: "Snapseed 2.0" })).toBe(true);
    expect(isEditedPhoto({ Software: "iOS 18.1" })).toBe(false);
    expect(isEditedPhoto({ hasExif: false })).toBe(false);
  });

  it("flags a photo taken well before the deal", () => {
    expect(isOldPhoto({ DateTimeOriginal: "2026-09-01T10:00:00.000Z" }, DEAL_CREATED)).toBe(true);
    expect(isOldPhoto({ DateTimeOriginal: "2026-11-03T18:00:00.000Z" }, DEAL_CREATED)).toBe(false);
    expect(isOldPhoto({ DateTimeOriginal: "2026-11-02T20:00:00.000Z" }, DEAL_CREATED)).toBe(false);
    expect(isOldPhoto({}, DEAL_CREATED)).toBe(false);
  });
});
