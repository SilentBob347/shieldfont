# The plain-text mode

`a11y={{ mode: "text" }}` gives a screen-reader user the real words of a
shielded block. The words ship inside the page, encrypted, and the reader's own
browser grinds out the key on request — a few seconds of work on a desktop,
once, per block.

## Where this stands

First of all this is a new challenging approach and it is in an early stage and
we don't yet have all the answers, Sway.

Accessibility is a complicated and unsolved problem everywhere in the world, and
this project can only 80/20 it. What follows is what we chose, what it costs,
and where it is still wrong — not a claim to have solved anything.

**A principle: for now, everyone sacrifices a little for the common good.** Some
people will take a few extra seconds to copy and paste. Screen readers will have
to wait for a puzzle to grind. That is a real cost and it is spread on purpose,
because the alternative is a page that works perfectly for most people by
failing completely for a few.

**But some things would have been unacceptable.** A screen reader reading out
gibberish. Someone using a custom face — dyslexia-friendly, high-contrast,
larger — getting scrambled text and never being told that is what happened. Both
of those are silent failures: the reader has no way to know the page is lying to
them, so they blame themselves or the writer.

That is why the wrapper exists, and why it is the default and the recommended
approach. It is the only arrangement where nobody is quietly misled.

**We do not want to be prescriptive about accessibility.** You know your
audience and your application, and you may reach it in ways this library does
not offer — pairing a shielded block with an audio reading, for instance. The
role of these docs is to give you a few things to think about if you want to do
something of your own. If you want a ready-to-go packaged solution, the full
wrapper is here, with its limitations stated.

---

**Since 0.3.2 this is on by default, and it draws something.** A bare
`<Shield>` now renders the FULL tier: an outline round the block and a strip
carrying one sentence and two buttons. Earlier versions drew nothing and put
the control off-screen where only a screen reader could reach it; the four
tiers below include that arrangement, and the section after them says why it
stopped being the default.

This page explains what each tier does, what it costs, what it does not fix,
and how the numbers were chosen.

```tsx
import { Shield } from "@shieldfont/react";

<Shield>{body}</Shield>
```

That is the whole API. Nothing to generate, nothing to host, no server.

---

## The four tiers

Three independent switches — `screenReader`, `explain`, `copyPaste` — make four
combinations anyone actually ships. There is no `tier` prop; these are names for
combinations, not an enum.

```tsx
<Shield>{body}</Shield>                                        // FULL
<Shield explain={false}>{body}</Shield>                        // INVISIBLE
<Shield explain={false} copyPaste={false}>{body}</Shield>      // MINIMAL
<Shield screenReader={false}>{body}</Shield>                   // SEALED SHUT
```

### What each one does

| | **FULL** *(default)* | **INVISIBLE** | **MINIMAL** | **SEALED SHUT** |
|---|---|---|---|---|
| **Screen readers** | Reads the sentence on its own focus stop, then two named buttons. Pressing Uncover grinds the puzzle and the real words are announced. | Identical. The control is real and focusable, clipped off-screen — a listener cannot tell this tier from FULL. | Identical to INVISIBLE. | **Nothing.** The block is `aria-hidden` with no alternative. A reader passes it in silence and is never told there was anything there. |
| **Missing font** | The strip's sentence swaps to the font-missing wording, the paragraph becomes a skeleton, and the same Uncover button is right there. | The clipped control un-clips itself and draws the identical row — shield, sentence, Uncover — with no box around it. | Same as INVISIBLE. | **Decoy words, in a fallback face.** Fluent, grammatical, wrong English, with nothing on screen to say so. |
| **localStorage** | One key per block once solved, holding the puzzle's **answer** — a number, not your text. Reopening is instant; the eraser in the demo bar clears them. | Same. | Same. | **Nothing stored.** There is no puzzle, so there is no answer to keep. |
| **Settings** | `screenReader` · `explain` · `copyPaste` — all three default on. | `explain={false}` and nothing else. `copyPaste` is independent of the wrapper, so it stays on. | `explain={false} copyPaste={false}` | `screenReader={false}`; the other two throw if passed, because there is nothing for them to open. |

### What each one costs

| | FULL | INVISIBLE | MINIMAL | SEALED SHUT |
|---|---|---|---|---|
| **On screen** | An outline and a strip. | Nothing. | Nothing. | Nothing. |
| **Markup, one block** | 30 elements, 5.1 kB | 17 elements, 3.5 kB | 17 elements, 3.3 kB | 1 element, 247 bytes |
| **Matchable English** | The whole sentence, the button words, the clipboard notice. | The note and the button name (`"scrambled"`, `"Uncover the plain text"`), plus the clipboard notice. | The note and the button name. | **None.** Nothing a crawler can pattern-match on. |
| **Copy & paste** | A selection touching protected text lands a short notice saying how to get the real words. | Same. | **Decoy words, silently.** The reader pastes fluent nonsense into their notes and finds out later, or never. | Decoy words, silently. |
| **WCAG 2.2** | Passes. | Passes. | Passes. | **Fails SC 1.3.1** — what a sighted reader perceives is not programmatically available. Under the EU Accessibility Act or the ADA Title II web rule that is a procurement blocker, not an ethics question. |

### Why FULL is the default

It was not, in 0.3.0 and 0.3.1. A bare `<Shield>` drew nothing, on the reasoning
that the wrapper's plain English is the one thing `setCamouflage()` cannot
rename — it renames attributes and font families, not prose — and so should be
opted into deliberately.

That reasoning is intact. The conclusion changed, because of who pays.

This library exists to deter **bots**. Every tier below FULL spends a **human's**
time to do it, and there are three of them:

- the reader on a screen reader, who hears silence where a paragraph was;
- the reader using their own typeface — dyslexia-friendly, high-contrast, larger
  — whose stylesheet overrides ours and turns the page to gibberish;
- the reader who selects a quote for a translator or their notes and gets fluent
  nonsense with nothing to explain it.

FULL is the only tier where none of those three is worse off. A crawler is no
better off under FULL than under MINIMAL: the words are sealed identically, and
what FULL adds is a sentence and two buttons — an obstacle to concealment, never
to the seal.

**MINIMAL is documented rather than recommended.** Its distinguishing behaviour
is that copying gives a human decoy words with no notice, which costs a person
something and costs a crawler nothing.

**SEALED SHUT is documented rather than hidden.** It is a real choice with a
real reason — maximum concealment, no signature at all — and a library that hid
its worst option would not be trustworthy about its best one. Know what you are
choosing: it fails an accessibility requirement that is law in several places.

### One thing no tier fixes

A reader who forces their own font can be **detected**, but only partly. If a
user stylesheet or an extension replaces the family for the whole block, the
substitution is measurable: the shielded face and the fallback produce different
text widths, and identical widths mean ours was not used. Note that
`document.fonts.check()` does **not** catch this — the face is loaded, just
unused, so it answers "yes" while the reader looks at gibberish.

What cannot be detected is **per-glyph fallback**: the face used for most of a
run with one missing character silently substituted. No page-visible API reports
the font actually used to draw a glyph. `CSS.getPlatformFontsForNode` knows, and
is DevTools-protocol only; `queryLocalFonts()` needs a permission prompt and
answers a different question — what is installed, not what was used.

This is the strongest argument for FULL. A drawn control does not need to detect
anything: it is already there when the reader needs it.

---

## The problem it solves

A shielded block holds a decoy. The HTML says one thing, the font draws
another. Reading the decoy aloud would be worse than silence — it is fluent,
grammatical, *wrong* English, and nothing about it announces itself as broken —
so `<Shield>` marks the block `aria-hidden="true"` and assistive technology
skips it in linear and heading navigation.

**Skipped is not the same as unreachable, and the docs used to claim it was.**
`aria-hidden` governs the reading order; it does not erase the words from the
page. NVDA's mouse-tracking and screen-review modes, and touch exploration on
iOS and Android, walk the DOM by screen position, and a reader using any of them
can land on a decoy word and hear it. So "nobody hears a decoy" was too strong:
what is true is that nobody hears one while reading the page the ordinary way.
A reader reported the exploration case in
[#2](https://github.com/isaqueseneda/shieldfont/issues/2).

Skipping is not a fix either. What a sighted reader perceives is then not
programmatically available at all, which fails WCAG 2.2 SC 1.3.1.

**The obvious answer is a link to a plain-text copy, and it does not work.**
That shipped in 0.2.0 as `{ mode: "text", href }` and was removed, because a URL
cannot be offered to a screen reader without being offered to everyone else. The
same crawl that reads the decoy reads the link sitting beside it. One line of
scraper code turned a protected block into an unprotected one, so a page using
the accessibility feature was *less* protected than a page that ignored it.

The replacement inverts the trade. The words are in the page, but closed. Nobody
is denied them. The accessible path simply stops being the **cheapest** path.

---

## How it works

At build time, each block gets its own **time-lock puzzle** (Rivest–Shamir–Wagner,
1996):

1. Pick two random primes, multiply them to get a number `n`.
2. Define the key as: start at 2 and square it, over and over, five million
   times, keeping only the remainder after dividing by `n`.
3. Encrypt the block's real text with that key.
4. Ship `n`, the step count, and the ciphertext. Throw the primes away.

To get the key you have to do those five million squarings. Each one needs the
answer to the one before it, so **the work cannot be split up**. A crawler with
a thousand GPUs still pays five million sequential steps per block. Their only
advantage is a faster single core — worth maybe three or four times a laptop,
which is exactly the narrow margin this design wants.

**The build is cheap because it holds a trapdoor.** Knowing the two primes
collapses the tower into two ordinary modular exponentiations. Measured on the
reference machine: **62 ms to seal a block that costs twenty seconds to open.**
A two-hundred-block site adds a few seconds to your build.

That asymmetry is the entire reason for choosing this over a hash chain. A hash
chain is equally sequential, but the builder pays exactly what the solver pays,
so the same site would cost half an hour to build.

### Freshness

Every block gets its own primes, on every build. Nothing is seeded, nothing is
reused, and there is no way to pin it. So:

- Solving one block teaches an attacker nothing about the next one.
- **Every redeploy invalidates every solution anyone has already computed.**

The same property expires your readers' cached solutions. That is the intended
trade and it is symmetric — it is precisely what expires the crawler's cache.

### The cache persists between visits, which a demo page will not want

Until the next deploy, a solved block stays solved in that reader's browser. The
key is your camouflage attribute plus the first 40 characters of the block's
ciphertext, in `localStorage`, and the solver checks it before it does anything
else — so a returning reader gets their words instantly and never sees the
button.

That is the right behaviour on a real site, and the wrong behaviour on any page
whose job is to SHOW the protection: a demo, a preview, a screenshot for a
README. Load it twice and the second visit renders plain text, which
demonstrates nothing, and a visitor who copies it gets your real words rather
than the decoys. If you run such a page, clear the keys before the solver runs:

```html
<!-- Demo pages only. Never ship this on a page you actually want protected. -->
<script>
  for (const k of Object.keys(localStorage))
    if (k.startsWith("data-typeface-")) localStorage.removeItem(k);
</script>
```

Use your own `attrName` prefix there if you called `setCamouflage`. Put it
before `<Shield>` renders, so it runs ahead of the solver's first sweep.

---

## How hard, and why

The default is `seconds: 20`. That number is chosen against the cost of OCR, and
the reasoning matters more than the figure.

**A crawler that wants your words never has to touch this puzzle.** It can
render the page and read the pixels: about one second of CPU to render, about
two to OCR. Call it **three seconds of server CPU per page**. That is the floor
on ShieldFont's protection, it exists whether or not this feature does, and no
amount of cryptography raises it.

So the target is not "expensive". The target is **not cheaper than OCR**. Set
the puzzle a bit above three server-seconds and the plain-text mode is no longer
the weak link — which is the only property that was ever needed.

This also means **difficulty has a ceiling**. Past the OCR cost, a crawler just
takes the cheaper door, so extra difficulty buys nothing at all and is paid for
entirely by disabled readers waiting longer. Twenty is near the top of the
useful range. `sealText` refuses anything above 120 seconds and anything below
five.

### Measured numbers

| | |
|---|---|
| Sealing one block | ~62 ms |
| Modulus | 2048-bit |
| Default step count | 5,000,000 sequential squarings |
| Chrome, desktop, `seconds: 20` (the default) | **7.6 s** |
| Chrome, desktop, `seconds: 10` | **4.0 s** |
| Reference rate used for labelling | 250,000 squarings/second |

The reference rate is deliberately conservative — roughly a mid-range phone
rather than a current desktop. `seconds` is therefore a **budget denominated on
a slow device**, not a promise about yours: a desktop finishes well inside it,
an old phone may exceed it. The button says "up to 20 seconds" for that reason —
a ceiling, not a point estimate — and within about 80 ms of a press the live
status line replaces it with a real measurement taken on the actual device.

A larger modulus is *not* more secure here. It makes each squaring slower, so
the same wait buys fewer sequential steps and the puzzle gets **cheaper** for the
crawler. 2048 bits is the sweet spot.

---

## What the reader hears

> **This section describes the INVISIBLE tier** — `<Shield explain={false}>`.
> It was written when that was the default. FULL draws the same control in a
> visible strip; everything below about what is *spoken* applies to both, and
> everything about what is *not drawn* applies only here.

Everything below was shaped by listening to it. The first version passed its
markup tests and was unpleasant to use; most of these decisions exist because of
a specific sentence heard in a real VoiceOver session.

### On this tier the control is invisible

The note and the button are clipped off-screen and left in the accessibility
tree. A sighted reader can already read the block perfectly — the font does that
work — so a note explaining an unlocking mechanism, attached to text that looks
fine, is an unexplained widget and nothing else.

That argument holds for the reader who can see the words. It does not hold for
the reader whose custom typeface has turned them to gibberish, or who reaches
for copy-paste, and that is why FULL exists and is now the default.

### The cost of that: keyboard focus disappears

**A sighted person navigating by keyboard, without a screen reader, will Tab
into a control they cannot see, and their focus indicator will vanish.** That is
a WCAG 2.2 SC 2.4.7 (Focus Visible) failure and it is deliberate: invisibility
was the requirement.

The standard remedy is the skip-link pattern — clipped until focused, visible
while focused — and it is **not implemented**. If you need 2.4.7, pass
`visualHidden: false` and the control is on screen for everyone.

### Where the words go

`reveal` decides that, and the default hides them too.

- **`"hidden"` (default).** The unlocked words are put into the page for
  assistive technology, clipped off-screen. The encoded block stays on screen,
  untouched. Nothing visibly changes; there is no layout shift and no second
  copy of the text for a sighted reader to be confused by.
- **`"visible"`.** The plain words replace the encoded block on screen. Costs a
  layout shift, and buys selection, copy-paste and browser translation of the
  real text for everybody.

Both modes ship **real text**, not an accessible name. `aria-label` was the
tempting shortcut and it is the wrong tool: a name is announced as one unbroken
string, cannot be navigated by word or sentence, and is prohibited on the
generic elements this renders. A paragraph delivered that way is close to
unusable.

The revealed element **mirrors the shield's own tag**. `<Shield as="h2">`
reveals into an `<h2>`, so heading navigation — the way most screen-reader users
move around a page — still finds it. An earlier cut always used a `<p>` and
silently dropped the outline. (A custom component in `as` cannot be mirrored, so
it falls back to `<p>`, or `<span>` inline.)

### Every button has the same name, on purpose

> Uncover the original text (up to 20 seconds)

**This inverted in 0.3.2 and the reason is worth stating.** The name used to
carry the element type and the block's position — "Unlock the plain text for
paragraph 2" — so that a listener meeting four buttons could tell them apart.
Then unlocking became page-wide: pressing any one button opens every block. Four
different names would describe four different actions where there is one.

The noun comes from `as`: heading, paragraph, quote, list item, caption, or
**section** for anything else (including the default `<div>`). The number counts
text-mode blocks on the page.

Identical labels were the problem. Every block used to render the same sentence,
which is fine on a one-block demo and unusable on an article: two buttons on one
page were indistinguishable by ear, so a reader who wanted the third one had to
activate buttons until they guessed right.

`label` overrides the whole string. **Never put the protected words in it.** The
label ships in the HTML, so a label quoting the text you are hiding hands it to
any scraper for free — the same free bypass as the `href` that was removed.

### The note is said once

The first text-mode block on a page gets the full explanation:

> If you use a screen reader, custom font, or translator, please uncover the
> text before reading.

Every block after it gets the short form:

> Scrambled text. Uncover the original below.

Measured over a multi-block page, the full sentence is spoken in its entirety
for every block, so a six-block article makes somebody listen to the same
explanation six times before reaching any content. That is not thoroughness, it
is an obstacle. `note` overrides the sentence for one block.

### How much it says while it works

1. The button is pressed. The work starts in a background thread, so the page
   stays scrollable and the screen reader stays usable.
2. Within about 80 ms the status line gives the measured estimate — "About 10
   seconds." — and, for waits of twenty seconds or more, adds "You can keep
   reading."
3. Interim updates are planned from that **measured** duration, not fixed:
   under 6 s, none at all; under 20 s, halfway only; 20 s and over, quarters.
   Fixed quarters on a four-second decode meant each update cut off the one
   before it — VoiceOver read the estimate back as "working this" before 25
   percent killed it.
4. The words arrive. In hidden mode the status line says "Done."; in visible
   mode, "Done. The text is shown below."
5. The **answer** is cached in that browser — a number, not your article. On a
   return visit the words are already there, the status line says "The text is
   ready.", and nothing takes focus.

Details that matter, and why:

- **The revealed element is its own polite live region**, so filling it speaks
  it. Moving focus there was supposed to be enough and was not: focus landed and
  announced the bare element role, never the text, so a reader pressed the
  button, heard "Done", and then could not find what they had waited for.
- **The revealed element becomes a real Tab stop** (`tabindex="0"`) once it has
  content — it ships at `-1` so an empty element is not a stop. This exists
  because of one sentence from a VoiceOver session: *"I kept pushing tab, and I
  couldn't re-read the text."* Tab moves between controls, the words were not
  one, and after the announcement finished there was no way back to them.
- **The status line is a bare `<span>` with `aria-live="polite"` and no role.**
  `role="status"` also puts a named landmark in the tree, so a screen reader
  passing an empty one says the word "status" for no reason, once per block —
  two spurious announcements on a two-block page before the reader reached any
  content. Removing the role left an empty `<p>` announcing "paragraph", so it
  is a `<span>`. `aria-atomic="true"` so an update is read whole rather than
  diffed against the previous one.
- **No `role="group"`, and the wrapper is `role="presentation"`.** The group
  role was there to "associate" the note with the button. What it actually
  produced on landing was roughly twenty words of scaffolding per block —
  "…button. Accessible alternative, group. You are currently on a button inside
  of a group. To exit this group press…" — in front of a control whose own name
  already says what it does. Dropping the role stopped the page *asking* to be a
  group; VoiceOver announced the plain `<div>` as one anyway, so the wrapper is
  presentational too. A note followed by a button reads perfectly well as two
  plain siblings.
- **The live region is polite, never assertive.** Assertive would interrupt
  whatever they are listening to, repeatedly, for a background task they were
  explicitly told to keep reading through.
- **The progress bar stays in the accessibility tree.** `<progress>` does not
  announce on its own, so exposing it costs a screen-reader user nothing and
  lets them query exact progress on demand. Sighted users get a smooth bar,
  screen-reader users get milestones they can listen through.
- **The button ships hidden** and is revealed by script only after it confirms
  the browser has `BigInt` and `crypto.subtle`. A control that cannot work is
  worse than no control, and worst of all for someone who cannot see that
  pressing it did nothing. When the check fails, no button ever appears and the
  status line says why.

---

## The options

```tsx
<Shield
  as="h2"
  a11y={{
    mode: "text",
    seconds: 20,          // 5..120, default 20
    reveal: "hidden",     // "hidden" (default) | "visible"
    label: undefined,     // overrides the button's accessible name
    note: undefined,      // overrides the explanatory sentence
    visualHidden: true,   // default true for text, false for audio
  }}
>
  {body}
</Shield>
```

| Option | Default | What it does |
|---|---|---|
| `seconds` | `20` | Grind time on the reference device. Range 5..120. Read "How hard, and why" before raising it. |
| `reveal` | `"hidden"` | `"hidden"` puts the words in the page for assistive technology only; `"visible"` replaces the encoded block on screen. |
| `label` | element type + position | The button's accessible name. Must not quote the protected words. |
| `note` | the sentence above | The explanatory sentence for this block. |
| `visualHidden` | `true` | Clips the whole control off-screen while keeping it in the accessibility tree. `false` puts it on screen. |

---

## Requirements and edge cases

**JavaScript is required**, along with `BigInt` and `crypto.subtle`. The rest of
ShieldFont works with JavaScript off — the font does that work — so this is the
one part that does not. With JS disabled the reader gets the explanatory note
and no button.

**`crypto.subtle` is absent on insecure origins.** Plain `http://` (other than
localhost) has no Web Crypto, so the control reports that it needs an https
connection rather than claiming the browser is too old.

**A strict Content-Security-Policy may forbid `blob:` workers.** The script
falls back to running on the main thread in short slices with a yield between
them. Slower, but the page keeps responding.

**Per-page numbering needs a render-pass scope.** Under React Server Components
you get one for free, and `withShieldRenderPass()` provides one for the
synchronous `renderToString` renderers. Without a scope there is no way to know
which block is which, so every block is numbered 1 and every block gets the long
note. It still works; it is just louder.

**Styling: do not un-hide the parts.** The button, progress bar and output ship
with both the `hidden` attribute and an inline `display:none`. A single line in
a CSS reset — `progress { display: block }` — is enough to override the
attribute alone and put a dead button and an empty progress bar on every page.
The inline style outranks any author rule that is not `!important`; the script
clears both together when it reveals something. If you write `!important` rules
against these elements, you will break them.

In `reveal: "hidden"` the output element also carries the clipping styles
inline, so it is already off-screen the instant it is un-hidden. Do not fight
them with `display` or `visibility` — either would remove the words from the
accessibility tree, which is the entire thing being delivered.

Style the parts with the class names, all derived from your camouflage
attribute: `…-alt` (wrapper), `…-alt-note`, `…-alt-btn`, `…-alt-status`,
`…-alt-out`. The progress element carries no class, only the `…-bar` data hook
the script wires it by. None of this is visible at all unless you set
`visualHidden: false`.

---

## What was tested, and with what

- **`@guidepup/virtual-screen-reader`, driven by Playwright.** A real
  implementation of accessibility-tree semantics, not a markup assertion, run
  over multi-block pages in both reveal modes.
- **Real VoiceOver on macOS, by hand.** This is what found the group chatter,
  the truncated announcements and the text nobody could get back to. Every
  decision in "What the reader hears" that cites a session came from here.
- **NVDA and JAWS are unverified.** Nobody has run this under either.
- **No axe scan, and no published test page.**

The focus-visible failure described above is known and unfixed. Do not read this
list as a conformance claim.

---

## What this does not fix

Said plainly, because the launch should not claim otherwise:

- **It is not conformance, and it never becomes conformance.** A protected block
  fails WCAG 2.2 SC 1.3.1 with this mode on. The words are not programmatically
  determinable; they are obtainable, after 5–20 seconds of the reader's CPU,
  with JavaScript. No auditor is obliged to accept that as equivalent and we do
  not ask them to. What this mode buys is that the words are always *reachable*
  by a human who wants them. That makes a protected page humane. It does not
  make it compliant, and nothing in `@shieldfont/react` should ever be described
  as making a site legally accessible. See
  [the accessibility warning](../README.md#-read-this-first-shieldfont-breaks-accessibility).
- **A reader who forced their own font is not reached by any of this.** They see
  the decoy, rendered fluently, with no signal — and the font-load guard cannot
  detect the case. Only the visible wrapper reaches them:
  [forced fonts](./integration.md#forced-fonts-the-one-with-no-signal).
- **A crawler that wants the text still gets it, more cheaply, via OCR.** This
  feature stops the accessible path being a *shortcut*. It does not stop
  scraping, and it is not a wall.
- **A reader who needs this waits.** Everyone else gets the words instantly.
  That is unequal access however carefully it is engineered, and it is a
  compromise, not a solution.
- **Keyboard users without a screen reader lose their focus indicator** on the
  invisible control. WCAG 2.2 SC 2.4.7. The skip-link remedy is not
  implemented; `visualHidden: false` is the workaround.
- **Once revealed, the plaintext is in the DOM.** A crawler that runs a real
  browser, presses the button and waits gets the words — having paid the cost,
  which is the deal.
- **Solve-once-and-republish is unaddressed.** Anyone who opens a block can post
  the text elsewhere. True of every scheme, including the font.
- **React only.** The paste-in CDN tier and `@shieldfont/core` ship none of
  this. Closing that gap needs a version that works without a React render.

If you work in accessibility engineering and see a better structure, this is the
highest-value contribution available in the project — starting with NVDA and
JAWS. See [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Using the primitive directly

The puzzle is independent of React and is exported for tooling:

```js
import { sealText, solveText } from "@shieldfont/core/puzzle";

const sealed = sealText("The words to protect.", { seconds: 20 });
// → { n: "…", t: 5000000, iv: "…", ct: "…" }

solveText(sealed); // really does the work; takes as long as it promises
```

`sealText` is Node-only — it needs `node:crypto` for prime generation — and is
exported from `@shieldfont/core/puzzle` rather than the package index, so
bundling the core package for a browser never pulls it in.

`{ steps }` sets the step count directly, skipping the seconds range check. It
exists for tests and for tooling that has measured its own audience. It is not a
way to make a page feel faster.
