import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientSource = readFileSync(
  resolve(process.cwd(), "packages/dsh-code-brand/lib/client.js"),
  "utf8",
);

function readHelper(name: string): (...args: number[]) => number {
  const match = clientSource.match(
    new RegExp(`function ${name}\\([^]*?\\n      \\}`),
  );
  if (match === null) {
    throw new Error(`${name} helper is missing from the client bundle`);
  }
  return Function(`return (${match[0]})`)();
}

describe("dsh-code-brand layout contract", () => {
  it("centers the code box between Harness and the collapse button", () => {
    const equalGapLeft = readHelper("equalGapLeft");

    expect(equalGapLeft(100, 200, 40)).toBe(130);
    expect(130 - 100).toBe(200 - (130 + 40));
  });

  it("keeps the code baseline centered on Harness", () => {
    const centeredTop = readHelper("centeredTop");

    expect(centeredTop(50, 14, 10)).toBe(52);
  });

  it("keeps a visible equal-gap position when the toggle box is mid-layout", () => {
    const fallbackLeft = readHelper("fallbackLeft");

    expect(fallbackLeft(100, 280, 40, 28)).toBe(156);
  });

  it("maps the Harness rect through the official SVG viewBox", () => {
    const badgeRightFromSvg = readHelper("badgeRightFromSvg");

    expect(badgeRightFromSvg(10, 156, 26, 156, 129.348, 52)).toBe(165.348);
  });
});
