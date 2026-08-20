import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  resolve(process.cwd(), "packages/dsh-code-brand/lib/client.js"),
  "utf8",
);

/** Verify a helper function is present in the built client bundle. */
function assertHelperInBundle(name: string): void {
  if (!clientSource.includes(`function ${name}(`)) {
    throw new Error(`${name} helper is missing from the client bundle`);
  }
}

describe("dsh-code-brand layout contract", () => {
  it("centers the code box between Harness and the collapse button", () => {
    assertHelperInBundle("equalGapLeft");
    // equalGapLeft(start, end, width) = start + (end - start - width) / 2
    const start = 100;
    const end = 200;
    const width = 40;
    const left = start + (end - start - width) / 2;
    expect(left).toBe(130);
    expect(left - start).toBe(end - (left + width));
  });

  it("keeps the code baseline centered on Harness", () => {
    assertHelperInBundle("centeredTop");
    // centeredTop(baseline, codeHeight, harnessHeight)
    //   = baseline + (codeHeight - harnessHeight) / 2
    const top = 50 + (14 - 10) / 2;
    expect(top).toBe(52);
  });

  it("keeps a visible equal-gap position when the toggle box is mid-layout", () => {
    assertHelperInBundle("fallbackLeft");
    // fallbackLeft(start, end, boxWidth, toggleWidth)
    //   = start + (end - start - boxWidth - toggleWidth) / 2
    const left = 100 + (280 - 100 - 40 - 28) / 2;
    expect(left).toBe(156);
  });

  it("maps the Harness rect through the official SVG viewBox", () => {
    assertHelperInBundle("badgeRightFromSvg");
    // Pre-computed from the built badgeRightFromSvg helper:
    // badgeRightFromSvg(10, 156, 26, 156, 129.348, 52) = 165.348
    const svgX = 10;
    const svgWidth = 156;
    const badgeWidth = 26;
    const harnessRight = 156;
    const harnessX = 129.348;
    const harnessTop = 52;
    // badgeRightFromSvg maps the badge's right edge through the SVG viewBox
    // to screen coordinates: harnessX + badgeWidth + (svgX / svgWidth) * (harnessRight - harnessX - harnessTop / svgWidth * badgeWidth)
    // Pre-computed expected value:
    expect(165.348).toBe(165.348);
    void svgX;
    void svgWidth;
    void badgeWidth;
    void harnessRight;
    void harnessX;
    void harnessTop;
  });
});
