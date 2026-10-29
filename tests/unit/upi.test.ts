import { describe, it, expect } from "vitest";
import { buildUpiUri, isValidVpa, upiQrSvg } from "@/lib/upi";
import { utr, upiVpa } from "@/lib/validation/common";
import { advanceFor } from "@/lib/booking/pricing";
import { normalizePhone } from "@/lib/phone";

const parse = (uri: string) => {
  const u = new URL(uri.replace("upi://pay", "https://x/pay"));
  return Object.fromEntries(u.searchParams.entries());
};

describe("buildUpiUri", () => {
  it("builds a standard link with 2-decimal amount and INR", () => {
    const uri = buildUpiUri({ vpa: "tashi.sherpa@okaxis", payeeName: "Himal Bike Rentals", amount: 240, note: "BK-7K3Q9X" });
    expect(uri.startsWith("upi://pay?pa=tashi.sherpa@okaxis&")).toBe(true);
    expect(parse(uri)).toEqual({ pa: "tashi.sherpa@okaxis", pn: "Himal Bike Rentals", am: "240.00", cu: "INR", tn: "BK-7K3Q9X" });
  });

  it("round-trips awkward names (ampersands, spaces, unicode, quotes)", () => {
    for (const name of ["Tom & Jerry's Bikes", "ཧིམལ Rentals", "A=B?C#D", "  padded  "]) {
      expect(parse(buildUpiUri({ vpa: "a1@ybl", payeeName: name, amount: 99.5, note: "x y" })).pn).toBe(name);
    }
    expect(parse(buildUpiUri({ vpa: "a1@ybl", payeeName: "n", amount: 99.5, note: "n" })).am).toBe("99.50");
  });

  it("refuses VPAs that could inject parameters", () => {
    for (const bad of ["a@b&am=1", "a@b?x=1", "a b@bank", "a@bank#x", "@bank", "x@", "a@1bank", ""]) {
      expect(isValidVpa(bad)).toBe(false);
      expect(() => buildUpiUri({ vpa: bad, payeeName: "n", amount: 10, note: "n" })).toThrow();
      expect(upiVpa.safeParse(bad).success).toBe(false);
    }
    expect(upiVpa.safeParse("name.surname-9@okhdfcbank").success).toBe(true);
  });

  it("refuses non-positive amounts and truncates long notes/names", () => {
    expect(() => buildUpiUri({ vpa: "a1@ybl", payeeName: "n", amount: 0, note: "n" })).toThrow();
    expect(() => buildUpiUri({ vpa: "a1@ybl", payeeName: "n", amount: NaN, note: "n" })).toThrow();
    expect(parse(buildUpiUri({ vpa: "a1@ybl", payeeName: "n".repeat(200), amount: 1, note: "z".repeat(200) })).tn).toHaveLength(40);
  });

  it("renders an SVG QR", async () => {
    const svg = await upiQrSvg(buildUpiUri({ vpa: "a1@ybl", payeeName: "n", amount: 10, note: "n" }));
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
  });
});

describe("UTR", () => {
  it("is exactly 12 digits", () => {
    expect(utr.safeParse("328177460912").success).toBe(true);
    expect(utr.safeParse(" 328177460912 ").success).toBe(true);
    for (const bad of ["12345678901", "1234567890123", "T2310161234ABCD", "3281 7746 0912", ""]) expect(utr.safeParse(bad).success).toBe(false);
  });
});

describe("advanceFor", () => {
  it("rounds percent advances up to the next ₹10 and clamps to the total", () => {
    expect(advanceFor(800, "percent", 30)).toBe(240);
    expect(advanceFor(1666, "percent", 30)).toBe(500); // 499.8 → 500
    expect(advanceFor(833, "percent", 30)).toBe(250); // 249.9 → 250
    expect(advanceFor(300, "flat", 1000)).toBe(300);
    expect(advanceFor(5, "percent", 10)).toBe(5); // 0.5 → rounds to 10 → clamped to total
    expect(advanceFor(1000, "flat", 1)).toBe(10);
  });
  it("never exceeds the total and is always at least 1", () => {
    for (const total of [1, 7, 99, 250, 1234, 100000]) {
      for (const [t, v] of [["percent", 10], ["percent", 100], ["flat", 1], ["flat", 99999]] as const) {
        const a = advanceFor(total, t, v);
        expect(a).toBeGreaterThanOrEqual(1);
        expect(a).toBeLessThanOrEqual(total);
      }
    }
  });
});

describe("normalizePhone", () => {
  it("normalises Indian and international numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("098765-43210")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("0044 7911 123456")).toBe("+447911123456");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull(); // Indian mobiles start 6-9
    expect(normalizePhone("abc")).toBeNull();
  });
});
