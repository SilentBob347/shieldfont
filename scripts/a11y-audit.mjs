/**
 * Screen-reader audit for `<Shield a11y={{ mode: "text" }}>`.
 *
 * Run with `npm run test:a11y`. Not part of `npm test`: it downloads and drives
 * a real browser, which is too heavy to sit in the unit-test loop.
 *
 * ## Why this exists
 *
 * The unit suite asserts on the React element tree. That is the right place for
 * "is the payload sealed" and "is the block aria-hidden", and it caught none of
 * the following, all of which shipped and all of which were found by running a
 * page:
 *
 *   - The solve button never appeared. The component rendered
 *     `data-typeface-status`; the solver looked for
 *     `data-typeface-solve-status`. Both halves were individually correct.
 *   - The encoded block stayed on screen under the revealed text, because a
 *     MutationObserver fired mid-parse and cached a null element reference.
 *   - Unlocking announced nothing. Focus moved to the words and the screen
 *     reader said "paragraph", never the text — so a reader waited, heard
 *     "Done", and landed on silence.
 *   - `role="group"` cost about twenty words of scaffolding per block:
 *     "Accessible alternative, group… you are currently on a button inside of a
 *     group… to exit this group press Control-Option-Shift-Up-Arrow."
 *
 * None of those are expressible as a markup assertion. They are properties of
 * what a screen reader SAYS, so they need something that says things.
 *
 * ## What drives it
 *
 * `@guidepup/virtual-screen-reader` walks the real accessibility tree, computes
 * accessible names to spec, honours `aria-hidden`, and reports live-region
 * updates as spoken phrases. Playwright supplies a real Chromium — needed
 * because the mode uses a Web Worker, `BigInt` and `crypto.subtle`, none of
 * which survive a DOM shim.
 *
 * It is a faithful simulator, not NVDA. It cannot tell you how JAWS behaves.
 * Treat a pass here as "no obvious regression", not as a conformance claim.
 *
 * The page is served over `http://localhost` on an ephemeral port rather than
 * `file://` or `setContent`, because `crypto.subtle` only exists in a secure
 * context and localhost is one.
 */
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { Shield, withShieldRenderPass } from "../packages/react/dist/Shield.js";
import { BLOCKS, DECOY_MARKERS, A11Y, serveFixture } from "./lib/a11y-fixture.mjs";

const failures = [];
const notes = [];
function check(ok, name, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) failures.push(name);
}

// The fixture and its server moved to lib/a11y-fixture.mjs when the NVDA audit
// arrived: two harnesses measuring different pages could not be compared, and
// the point of the NVDA run is that it walks the same page this one does.
const { origin, close } = await serveFixture({ withVsr: true });

// ---- Drive it ---------------------------------------------------------------

const browser = await chromium.launch();
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (m) => m.type() === "error" && pageErrors.push(m.text()));

try {
  await page.goto(origin);
  await page.evaluate(async () => {
    const m = await import("/vsr.js");
    window.__v = m.virtual;
    await window.__v.start({ container: document.body });
  });

  console.log("\n=== What the page ships ===");
  const served = await page.content();
  // The sealed payloads must not contain the words they seal. The encoded
  // blocks are a separate mechanism with a separate, documented property
  // (words outside the mapping pass through), so they are excluded here.
  const payloads = [...served.matchAll(/type="application\/json"[^>]*>(.*?)<\/script>/gs)].map((m) => m[1]);
  check(payloads.length === BLOCKS.length, "one sealed payload per block", `${payloads.length} found`);
  const leaked = BLOCKS.filter((b) => payloads.some((p) => p.includes(b.text)));
  check(leaked.length === 0, "no plaintext in any sealed payload");
  const labels = [...served.matchAll(/<button[^>]*>(.*?)<\/button>/gs)].map((m) => m[1]);
  check(
    !BLOCKS.some((b) => labels.some((l) => b.text.split(" ").some((w) => w.length > 6 && l.includes(w)))),
    "no protected words in any button label",
  );

  console.log("\n=== What a screen reader says, top to bottom ===");
  const spoken = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 60; i++) {
      await window.__v.next();
      const phrase = await window.__v.lastSpokenPhrase();
      // next() wraps at the end of the document. A fixed step count therefore
      // walked back over the top of the page and counted the first block twice.
      if (out.length && phrase === out[0]) break;
      out.push(phrase);
      if (/^end of main$/i.test(phrase.trim())) break;
    }
    return out;
  });
  spoken.slice(0, 16).forEach((p) => console.log("   · " + p));

  check(
    !spoken.some((p) => DECOY_MARKERS.some((d) => p.includes(d))),
    "the decoy is never spoken",
  );
  check(!spoken.some((p) => /^status$/i.test(p.trim())), "no bare 'status' announcement");
  check(!spoken.some((p) => /\bgroup\b/i.test(p)), "no group scaffolding");

  // THE BUTTONS DELIBERATELY SOUND ALIKE NOW, and this check was inverted to
  // say so. It used to require a distinct name per block, built from the
  // element's noun and ordinal — "Unlock the plain text for paragraph 2" — on
  // the reasoning that a listener meeting four identical buttons cannot tell
  // them apart. True, and it stopped mattering when unlocking became
  // page-wide: pressing any one of them opens every block, so four different
  // names would describe four different actions where there is one.
  const solves = spoken.filter((p) => /^button, Uncover/.test(p.trim()));
  check(solves.length === BLOCKS.length, "every block has a solve button", `${solves.length}/${BLOCKS.length}`);
  check(new Set(solves).size === 1, "all solve buttons share one name (unlock is page-wide)",
    [...new Set(solves)].join(" | ").slice(0, 60));
  check(solves.every((p) => /seconds/.test(p)), "the name says what it costs before you press it");

  // The long explanation once, the short one after. Matched on the SHORT note's
  // opening rather than on a phrase from the long one: the wording of the long
  // note is author-configurable and has changed twice, while "Scrambled text."
  // is the repeat form and is what the count is actually about.
  const shortNotes = spoken.filter((p) => p.includes("Scrambled text."));
  check(shortNotes.length === BLOCKS.length - 1,
    "the long note is spoken once, the short one thereafter",
    `${shortNotes.length} short of ${BLOCKS.length - 1}`);

  console.log("\n=== Keyboard reachability ===");
  // TWO STOPS PER BLOCK, NOT ONE. The note is `tabIndex=0` — it was made a real
  // tab stop because a screen reader at default verbosity skips
  // aria-describedby, so the sentence was never heard. That doubled the tab
  // sequence, and a loop expecting four consecutive buttons started landing on
  // notes and failing. Walk the whole sequence and assert on what it contains.
  // Walk two stops past the end and count UNIQUE elements: Tab wraps at the end
  // of the document, so a fixed step count revisits the first stop and reported
  // five notes on a four-block page. The extra steps are deliberate — they are
  // what would catch a third stop per block — but they must not be counted twice.
  const stops = [];
  const seenStops = new Set();
  for (let i = 0; i < BLOCKS.length * 2 + 2; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      el.dataset.auditStop = el.dataset.auditStop || String(Math.random());
      return {
        id: el.dataset.auditStop,
        text: (el.textContent || "").trim().slice(0, 40),
        role: el.getAttribute("role") || el.tagName.toLowerCase(),
      };
    });
    if (seenStops.has(stop.id)) continue;
    seenStops.add(stop.id);
    stops.push(stop);
  }
  const btnStops = stops.filter((s) => s.role === "button" && /Uncover/.test(s.text));
  const noteStops = stops.filter((s) => s.role === "note");
  // EXACT, not >=. These were `>=`, which passes for five notes on four blocks
  // — so the one thing they are really guarding against, a stray extra focus
  // stop appearing per block, could not fail them. Two stops per block is the
  // deliberate cost (the note had to become focusable or screen readers never
  // spoke it); three would be a regression and now reads as one.
  check(btnStops.length === BLOCKS.length, "every block's button is reachable by Tab",
    `${btnStops.length}/${BLOCKS.length}`);
  check(noteStops.length === BLOCKS.length, "every block's note is its own Tab stop, and only one",
    `${noteStops.length}/${BLOCKS.length}`);

  console.log("\n=== Unlocking ===");
  await page.evaluate(() => window.__v.clearSpokenPhraseLog());
  const target = BLOCKS[1];
  await page.focus("[data-typeface-solve]:nth-of-type(1)").catch(() => {});
  const buttons = await page.$$("[data-typeface-solve]");
  await buttons[1].focus();
  const t0 = Date.now();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => [...document.querySelectorAll("[data-typeface-out]")].some((o) => o.textContent.length > 0),
    null,
    { timeout: 120000, polling: 250 },
  );
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const said = await page.evaluate(() => window.__v.spokenPhraseLog());
  said.forEach((p) => console.log("   · " + p));
  check(said.some((p) => p.includes(target.text)), "the real words are spoken on completion", `${elapsed}s`);
  check(
    said.filter((p) => /percent/.test(p)).length === 0,
    "short waits get no interim percentages",
  );

  // UNLOCKING ONE UNLOCKS THE PAGE. Asserted here because it is the behaviour
  // that made "revealed text mirrors the block's tag" fail: the check took the
  // FIRST output with content, which after a page-wide unlock is the <h2>, not
  // the paragraph whose button was pressed.
  // WAIT FOR ALL OF THEM, not just the one that was pressed.
  //
  // The wait above is `.some()`, so it returns the moment the FIRST block
  // finishes — and this counted immediately after. On a fast machine the other
  // three had already landed and it passed; on a CI runner they had not, and it
  // reported 1/4. A green local run and a red remote one for a difference in
  // machine speed is the worst kind of test, because the first instinct is to
  // distrust the runner rather than the assertion.
  //
  // Each block grinds its own puzzle independently, so "all four" genuinely
  // takes longer than "any one" — the page-wide unlock starts them together, it
  // does not make them finish together.
  await page
    .waitForFunction(
      (n) =>
        [...document.querySelectorAll("[data-typeface-out]")].filter((o) => o.textContent.length)
          .length === n,
      BLOCKS.length,
      { timeout: 120000, polling: 250 },
    )
    .catch(() => {});
  const opened = await page.evaluate(() =>
    [...document.querySelectorAll("[data-typeface-out]")].filter((o) => o.textContent.length).length,
  );
  check(opened === BLOCKS.length, "pressing one button unlocks every block",
    `${opened}/${BLOCKS.length}`);

  const state = await page.evaluate((want) => {
    // The output belonging to the block that was actually pressed.
    const out = [...document.querySelectorAll("[data-typeface-out]")].find(
      (o) => o.textContent.trim() === want,
    );
    const cs = getComputedStyle(out);
    return {
      tag: out.tagName,
      tabStop: out.getAttribute("tabindex") === "0",
      inTree: cs.display !== "none" && cs.visibility !== "hidden",
      clipped: cs.clipPath === "inset(50%)",
      encodedStillVisible: getComputedStyle(document.querySelectorAll("[data-typeface]")[1]).display !== "none",
    };
  }, target.text);
  check(state.tag === "P", "revealed text mirrors the block's tag", state.tag);
  check(state.tabStop, "revealed text is a Tab stop, so it can be re-read");
  check(state.inTree, "revealed text is in the accessibility tree");
  check(state.clipped, "revealed text is clipped off-screen, not removed");
  check(state.encodedStillVisible, "the encoded block stays on screen (hidden reveal)");

  // ---- SECOND PASS: THE FULL TIER, which is what a bare <Shield> renders ----
  //
  // Everything above audits INVISIBLE. FULL is the default since 0.3.2 and
  // nothing had ever driven a screen reader over it — the tier most consumers
  // get was the one tier with no spoken-output test. Its markup is different in
  // kind, not degree: a drawn strip, a visible sentence that is also a focus
  // stop, a Copy button beside the Uncover one, and a live region that reports
  // progress. Every one of those is a chance to say something twice.
  console.log("\n=== FULL tier: what a screen reader says ===");
  await page.goto(origin + "/full");
  await page.evaluate(async () => {
    const m = await import("/vsr.js");
    window.__v = m.virtual;
    await window.__v.start({ container: document.body });
  });
  const fullSpoken = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 40; i++) {
      await window.__v.next();
      const phrase = await window.__v.lastSpokenPhrase();
      if (out.length && phrase === out[0]) break;
      out.push(phrase);
      if (/^end of main$/i.test(phrase.trim())) break;
    }
    return out;
  });
  fullSpoken.slice(0, 14).forEach((p) => console.log("   · " + p));

  check(
    !fullSpoken.some((p) => DECOY_MARKERS.some((d) => p.includes(d))),
    "FULL: the decoy is never spoken",
  );
  // The sentence is drawn on screen AND is its own focus stop with an explicit
  // aria-label. A visible sentence that is also a note is the arrangement that
  // took four attempts to get right — aria-label on the group (skipped),
  // aria-describedby (suppressed at default verbosity), a focusable note with
  // no name (role="note" is name-from-author-only, so it had none).
  // Spoken at all, and reached as a note. On this tier the sentence is drawn on
  // screen and is a `role="note"` WITH CHILDREN, so a reader walks into it and
  // hears the text as content; on the clipped tier it is a leaf with an
  // aria-label and comes out as `note, <text>`. Both are heard, which is what
  // this checks — the shape of the announcement is not the point, the four
  // earlier attempts that were silent are.
  const explained = fullSpoken.filter((p) => /screen reader, custom font/.test(p));
  check(explained.length >= 1, "FULL: the explanation is spoken");
  check(
    fullSpoken.some((p, i) => /^note$/.test(p.trim()) && /screen reader/.test(fullSpoken[i + 1] || "")),
    "FULL: and it is reached as a note, not as loose text",
  );
  // ONCE PER PAGE, NOT ONCE PER BLOCK. This was a `note:` the audit printed and
  // did not fail on — the drawn tier repeated the full sentence on every strip
  // where the clipped tier had shortened after the first block since 0.3.0. It
  // is an assertion now that both tiers do it. The VISIBLE text is still the
  // full sentence on every block; only the spoken name shortens.
  check(
    explained.length === 1,
    "FULL: the long sentence is spoken once per page, not once per block",
    `${explained.length}x`,
  );
  // Both controls named, and the names differ — here they SHOULD, because Copy
  // and Uncover do different things to the same block.
  const acts = fullSpoken.filter((p) => /^button,/.test(p.trim()));
  check(acts.some((p) => /Uncover/.test(p)), "FULL: the uncover button is named");
  check(acts.some((p) => /Copy/.test(p)), "FULL: the copy button is named");
  // NOT "no group scaffolding". The clipped tier had its group role removed
  // because it wrapped a sentence and a button and bought a listener nothing;
  // this tier is a drawn box around a whole paragraph and two strips, where the
  // boundary is the only way to tell one block's bottom strip from the next
  // block's top strip. Shield.tsx argues both, at length, and both are right.
  // What matters here is that the group is NAMED and that no two sound alike.
  const groups = fullSpoken.filter((p) => /^group,/.test(p.trim()));
  check(groups.length === 2, "FULL: each block is a named group", `${groups.length}`);
  check(new Set(groups).size === groups.length, "FULL: no two blocks sound alike");
  // The group name is the IDENTIFIER, deliberately: the disclaimer is already
  // spoken on its own focus stop, so putting it in the name too is one telling
  // too many. Asserted rather than noted, now that the code and the comment
  // above role="group" in Shield.tsx finally agree.
  check(
    groups.every((g) => !/screen reader, custom font/.test(g)),
    "FULL: the group name is a boundary, not a second copy of the sentence",
  );
  check(!fullSpoken.some((p) => /^status$/i.test(p.trim())), "FULL: no bare 'status' announcement");
  // The progress bar is aria-hidden on purpose: NVDA ships "Progress bar
  // output: Beep" ON and the solver drives ~200 updates across the wait.
  check(
    !fullSpoken.some((p) => /progress ?bar/i.test(p)),
    "FULL: the progress bar is out of the accessibility tree",
  );

  check(pageErrors.length === 0, "no page errors", pageErrors.join("; ") || "none");
} finally {
  await browser.close();
  close();
}

console.log(
  failures.length
    ? `\n${failures.length} FAILED:\n  - ${failures.join("\n  - ")}\n`
    : "\nAll screen-reader checks passed.\n",
);
if (notes.length) notes.forEach((n) => console.log("note: " + n));
process.exit(failures.length ? 1 : 0);
