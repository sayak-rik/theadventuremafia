import { describe, it, expect } from "vitest";
import { MAX_VIDEO_UPLOAD_BYTES, assertValidVideo, newVideoKey } from "@/lib/video";

const mp4 = (size = 100) => {
  const buf = Buffer.alloc(size);
  buf.write("ftyp", 4, "ascii"); // MP4 "ftyp" box at offset 4
  return buf;
};

describe("video", () => {
  it("accepts a plausible MP4 buffer under the size cap", () => {
    expect(() => assertValidVideo(mp4(1000))).not.toThrow();
  });

  it("rejects an empty buffer", () => {
    expect(() => assertValidVideo(Buffer.alloc(0))).toThrow(/under 25 MB|valid video/);
  });

  it("rejects a buffer over the 25 MB cap", () => {
    const big = Buffer.alloc(MAX_VIDEO_UPLOAD_BYTES + 1);
    big.write("ftyp", 4, "ascii");
    expect(() => assertValidVideo(big)).toThrow(/25 MB/);
  });

  it("rejects a non-MP4 file by its magic bytes", () => {
    const notMp4 = Buffer.alloc(1000); // no "ftyp" signature
    expect(() => assertValidVideo(notMp4)).toThrow(/MP4/);
  });

  it("rejects a too-short buffer before reading past its bounds", () => {
    expect(() => assertValidVideo(Buffer.alloc(5))).toThrow(/valid video/);
  });

  it("keys are random and scoped under the company's own prefix", () => {
    const a = newVideoKey(42);
    const b = newVideoKey(42);
    expect(a).toMatch(/^c\/42\/[0-9a-f]{24}\.mp4$/);
    expect(a).not.toBe(b);
  });
});
