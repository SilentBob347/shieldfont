/**
 * REAL NVDA audit. Windows only.
 *
 * Run with `npm run test:a11y:nvda`. `npm run test:a11y` is the sibling that
 * runs everywhere: it drives `@guidepup/virtual-screen-reader`, a faithful
 * simulation of the accessibility tree. This one drives NVDA itself.
 *
 * ## Why a simulator was not enough
 *
 * Issue #2 is a screen-reader bug report, and its central criticism is that
 * this project had only ever been tested with VoiceOver — which is under half
 * of screen reader users. Every reply has had to say "NVDA is unverified".
 * A simulator answers "what is in the accessibility tree"; it cannot answer
 * "what does NVDA say", and the two differ. Two decisions in this package rest
 * entirely on NVDA behaviour nobody here has heard:
 *
 *   - The progress bar is `aria-hidden` because NVDA ships "Progress bar
 *     output: Beep" ON and the solver drives ~200 updates across the wait.
 *   - The sentence is a real focus stop because screen readers skip
 *     `aria-describedby` at default verbosity.
 *
 * Both are reasoned, not measured. This script is how they stop being guesses.
 *
 * ## How it captures speech
 *
 * Guidepup opens a TLS socket to 127.0.0.1:6837 and speaks NVDA's Remote Access
 * protocol, receiving `speak` events. That is NVDA's own speech commands pushed
 * out as they happen — not screen-scraping and not inference. NVDA Remote
 * merged into NVDA core in 2025.1, so no third-party add-on is needed.
 *
 * ## Why the assertions are loose
 *
 * Substring matching on the phrase log, never exact snapshots. NVDA's
 * punctuation, spacing and role phrasing vary across versions, verbosity
 * settings and the paired browser. An exact-match suite here would fail on the
 * next NVDA release for reasons that have nothing to do with this package, and
 * a test that cries wolf gets deleted. Each check below asserts the one fact it
 * exists to protect and nothing about how NVDA chose to word it.
 *
 * ## What a green run does NOT license
 *
 * NVDA, at one version, at default verbosity, in one browser, reading linearly.
 * It says nothing about JAWS. It says nothing about non-default verbosity — and
 * note that the focus-stop decision above exists precisely BECAUSE default
 * verbosity suppresses descriptions, so the setting is load-bearing. And it
 * cannot reach touch exploration or screen review, which is the actual finding
 * in issue #2: `aria-hidden` governs reading order, not screen position, so a
 * reader moving by screen position can still land on a decoy. No automated
 * harness reaches that. Keep saying so.
 */
import { nvda, WindowsKeyCodes, WindowsModifiers } from "@guidepup/guidepup";
import { chromium } from "playwright";
import { BLOCKS, DECOY_MARKERS, serveFixture } from "./lib/a11y-fixture.mjs";

if (process.platform !== "win32") {
  console.error(
    "\nnvda-audit: Windows only — NVDA does not exist on " + process.platform + ".\n" +
      "  On macOS/Linux run `npm run test:a11y`, which drives a simulated\n" +
      "  accessibility tree and runs anywhere. The real-NVDA job runs in CI on\n" +
      "  windows-latest; see .github/workflows/test.yml.\n",
  );
  process.exit(0);
}

const failures = [];
const check = (ok, name, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures.push(name);
};

const { origin, close } = await serveFixture();
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

/** Walk forward until `want` is satisfied or we run out of patience. */
async function walk(steps) {
  const said = [];
  for (let i = 0; i < steps; i++) {
    await nvda.next();
    said.push(await nvda.lastSpokenPhrase());
  }
  return said;
}

try {
  await nvda.start();

  // ---- The drawn tier, which is what a bare <Shield> renders ---------------
  await page.goto(origin + "/full");
  await page.bringToFront();
  await nvda.clearSpokenPhraseLog();

  const spoken = await walk(24);
  console.log("\n=== NVDA, drawn tier, top to bottom ===");
  spoken.forEach((p) => console.log("   · " + p));
  const all = spoken.join(" | ").toLowerCase();

  // 1. THE ONE THAT MATTERS MOST. A decoy read aloud is fluent, grammatical,
  //    wrong English with nothing to mark it as broken — worse than silence,
  //    and the reason the block is aria-hidden in the first place.
  check(
    !DECOY_MARKERS.some((d) => all.includes(d.toLowerCase())),
    "the decoy is never spoken",
    DECOY_MARKERS.join(", "),
  );

  // 2. The wait is disclosed BEFORE the press, not after. A reader who commits
  //    to a control and then discovers it costs them twenty seconds has been
  //    handed a surprise, not a choice.
  check(
    all.includes("uncover") && /takes a few seconds|seconds/.test(all),
    "the uncover control names its cost before it is pressed",
  );

  // 3. scbaker's exact question. The sentence has to be reachable and spoken —
  //    four earlier attempts put it somewhere screen readers silently skip.
  check(
    /screen reader|uncover the text|please uncover/.test(all),
    "the explanation is spoken at all",
  );

  // 4. The progress bar must not be in the tree. This is the check that exists
  //    only because of NVDA: "Progress bar output: Beep" is ON by default and
  //    the solver drives ~200 updates. Nothing else in this suite can see it.
  check(!all.includes("progress bar"), "the progress bar is out of the tree");

  console.log(`\n${failures.length ? failures.length + " FAILED" : "All NVDA checks passed."}\n`);
} finally {
  await nvda.stop().catch(() => {});
  await browser.close();
  close();
}

process.exit(failures.length ? 1 : 0);
