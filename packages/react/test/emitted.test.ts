/**
 * The emitted browser scripts are STRINGS, so TypeScript never checks them and
 * every other test in this suite inspects React trees rather than running them.
 * That gap is not theoretical: an over-broad edit removed the middle of a
 * function here, shipped a script with unbalanced braces, and all 188 tests
 * still passed. The page would have been dead on arrival.
 *
 * These tests parse what actually ships.
 */
import { describe, it, expect } from "vitest";
import { Script } from "node:vm";
import { noticeScript } from "../src/notice.js";
import { solverScript } from "../src/solver.js";

const NAMES = {
  attr: "data-typeface-a8f3",
  flag: "__fg_a8f3__",
  logPrefix: "[typeface a8f3]",
  storePrefix: "data-typeface-a8f3-",
};
const emitted = () => [
  ["notice", noticeScript({ ...NAMES, family: "Optik a8f3" })],
  ["solver", solverScript(NAMES)],
] as const;

describe("the emitted browser scripts", () => {
  it("are syntactically valid JavaScript", () => {
    for (const [name, src] of emitted()) {
      expect(() => new Script(src), `${name} does not parse`).not.toThrow();
    }
  });

  it("carry no comments — every byte ships on every page", () => {
    for (const [name, src] of emitted()) {
      expect(src, `${name} carries a block comment`).not.toMatch(/\/\*/);
      expect(src.split("\n").filter((l) => l.trim().startsWith("//")), name).toHaveLength(0);
    }
  });

  it("name nothing that identifies the mechanism", () => {
    // setCamouflage() renames attributes and font families. It cannot rename a
    // word sitting inside the script, so one careless string here undoes a
    // project's whole per-site signature.
    const banned = [
      "shield", "Shield", "puzzle", "decoy", "scramble", "protect",
      "original", "plain text", "AI bot", "progress bar",
    ];
    for (const [name, src] of emitted()) {
      // TextEncoder/TextDecoder legitimately contain "encod"; nothing else may.
      const stripped = src.replace(/Text(Encoder|Decoder)/g, "");
      for (const word of banned) {
        expect(stripped.includes(word), `${name} leaks "${word}"`).toBe(false);
      }
    }
  });

  it("reference only elements the server actually renders", () => {
    // The break that motivated this file: the script wrote into `-short` after
    // the markup had been renamed to `-say-full`, so the sentence was never
    // filled and a screen reader had nothing to read. Nothing type-checks the
    // join between these two halves, so assert it.
    const notice = noticeScript({ ...NAMES, family: "Optik a8f3" });
    // `-full]` alone would match `-say-full]`, which is the element we WANT.
    for (const dead of ["-short]", "-tip]", "-tip-panel]", "[' + A + '-full]"]) {
      expect(notice.includes(dead), `writes into removed ${dead}`).toBe(false);
    }
    expect(notice).toContain("-say-full]");
  });
});
