import { describe, expect, it } from "vitest";
import { centsToUsdInput, formatMoney, usdToCents } from "./money";

describe("money", () => {
  it("formats integer cents as USD with two decimals", () => {
    expect(formatMoney(1000)).toBe("10.00 USD");
    expect(formatMoney(3750)).toBe("37.50 USD");
    expect(formatMoney(10000)).toBe("100.00 USD");
  });

  it("converts a decimal USD string to cents without float drift", () => {
    expect(usdToCents("10")).toBe(1000);
    expect(usdToCents("37.5")).toBe(3750);
    expect(usdToCents("37.50")).toBe(3750);
    expect(usdToCents("100.00")).toBe(10000);
    expect(usdToCents(" 0.10 ")).toBe(10);
  });

  it("round-trips cents through the form input format", () => {
    expect(centsToUsdInput(3750)).toBe("37.50");
    expect(usdToCents(centsToUsdInput(9999))).toBe(9999);
  });
});
