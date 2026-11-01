---
name: Project Shield
description: Escrow and AI evidence arbitration for peer-to-peer sales on PayPal.
colors:
  postal-ink: "oklch(0.45 0.19 265)"
  postal-ink-deep: "oklch(0.38 0.17 265)"
  postal-ink-wash: "oklch(0.95 0.03 265)"
  paper: "oklch(0.975 0.006 75)"
  sheet: "oklch(0.993 0.003 75)"
  kraft: "oklch(0.945 0.014 75)"
  rule-line: "oklch(0.89 0.012 75)"
  ink: "oklch(0.24 0.015 265)"
  ink-muted: "oklch(0.50 0.015 265)"
  on-postal-ink: "oklch(0.99 0.004 75)"
  cleared: "oklch(0.50 0.13 150)"
  cleared-wash: "oklch(0.95 0.04 150)"
  flagged: "oklch(0.52 0.13 60)"
  flagged-wash: "oklch(0.96 0.05 80)"
  blocked: "oklch(0.52 0.19 27)"
  blocked-wash: "oklch(0.96 0.03 27)"
typography:
  amount:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "2rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  data:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\" 1"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.postal-ink}"
    textColor: "{colors.on-postal-ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.postal-ink-deep}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "48px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.postal-ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
    height: "48px"
  state-stamp:
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  holding-slip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  panel:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Project Shield

> Visual source of truth. Product rules live in `PRODUCT.md`; architecture and code rules live in the
> local agent manual (`../AGENTS.md`, not versioned). The frontmatter tokens are normative and are mirrored 1:1 as CSS variables in
> `app/globals.css`. Generated with the `impeccable` skill (register: **product**). Re-run
> `/impeccable document` once real screens exist, to refresh tokens and write the
> `.impeccable/design.json` sidecar.

## 1. Overview

**Creative North Star: "The Postal Counter"**

A post office counter is where two strangers trust a third party with something of value. The
clerk weighs the parcel, stamps the slip, keeps the receipt, and nobody argues because the record
is right there. This interface is that counter: warm paper surfaces, one ultramarine ink used like
a rubber stamp, numbers set in mono like a printed receipt, and every decision written down.
The feel is Stripe and Wise: sober, precise, quietly confident. The tool disappears into the task.

Scene that sets the theme: *a buyer on a phone in daylight, mid-chat with a stranger from
Marketplace, deciding whether to send 40 USD; later, a mediator at a laptop in an office going
through a queue.* Both are daylight, focused, slightly anxious. The theme is **light only** for
the MVP. Dark mode is out of scope.

Density is "daily app": generous on buyer and seller screens (one decision at a time), denser on
the mediator screens (AG Grid, side-by-side evidence). Layout is a single column at 375 px that
widens to a centered 640 px column for buyer and seller, and a two-pane layout from `lg` for the
mediator. Full-height views use `min-h-[100dvh]`, never `h-screen`. Screen gutter 16 px, 24 px
from `md`.

Motion is **restrained**: state changes only, 150 to 250 ms, ease-out-quart
(`cubic-bezier(0.25, 1, 0.5, 1)`). Motion explains change (a stamp landing on the slip, a
timeline row appearing, an audit step ticking). No perpetual loops, no page-load choreography, no
bounce. Under `prefers-reduced-motion`, opacity fades only. Animate only `transform` and `opacity`.

This system explicitly rejects: **a PayPal clone** (no PayPal blue and yellow, no PayPal logo
outside the official Checkout button), **the generic AI SaaS landing** (purple gradients,
glassmorphism, gradient text, rows of identical icon cards), **crypto and web3 aesthetics** (neon
on black, glows, exchange tickers), and **traditional banking** (navy and gold, formal and cold).

**Key Characteristics:**
- Warm paper neutrals, one ultramarine "postal ink" accent, three semantic tones.
- Money and evidence data in Geist Mono with tabular figures; everything else in Geist.
- Flat surfaces separated by 1 px rules and tonal layers, not shadows.
- Every deal screen opens with the Holding Slip: amount, state, who acts next, deadline.
- AI output is shown as a written record with reasons, never as a bare verdict.

## 2. Colors: The Post Office Palette

Restrained: tinted kraft-and-paper neutrals carry the surface, postal ink carries action and
custody, and three semantic tones mark outcomes.

### Primary
- **Postal Ink** (`postal-ink`): primary buttons, links, focus rings, the "funds held" and "in
  progress" stamps, the active role in the role switcher. It means *the platform holds the money
  or is acting on it*.
- **Postal Ink Deep** (`postal-ink-deep`): hover and pressed state of primary actions only.
- **Postal Ink Wash** (`postal-ink-wash`): background of selected rows, the current timeline
  step, and in-progress stamps.

### Neutral
- **Paper** (`paper`): page background everywhere.
- **Sheet** (`sheet`): raised content surfaces (Holding Slip, inputs, evidence slots).
- **Kraft** (`kraft`): the second neutral layer: side panels, the role switcher, demo-only
  areas, grouped secondary information.
- **Rule Line** (`rule-line`): 1 px borders, dividers, input strokes.
- **Ink** (`ink`): body text and headings. Never pure black.
- **Ink Muted** (`ink-muted`): secondary text, helper text, timestamps, placeholder text.
- **On Postal Ink** (`on-postal-ink`): text on primary buttons. Never pure white.

### Semantic
- **Cleared** (`cleared`, wash `cleared-wash`): evidence passed, funds released.
- **Flagged** (`flagged`, wash `flagged-wash`): escalated to the mediator, dispute open, needs a
  human. Amber, never red: a flag is not a failure.
- **Blocked** (`blocked`, wash `blocked-wash`): evidence rejected, shipping blocked, refund issued,
  form errors.

### Named Rules
**The Rubber Stamp Rule.** Postal Ink covers at most 10% of any screen. It is the stamp, not the
paper. If a screen has two filled Postal Ink buttons, one of them is wrong.

**The Not-PayPal Rule.** PayPal blue and yellow never appear in our own UI. The only PayPal
colors on screen come from the official PayPal Checkout button, rendered by PayPal's SDK.

**The Color-Plus-Words Rule.** No state is shown by color alone. Every tone ships with an icon
and a text label.

## 3. Typography

**Body Font:** Geist (fallback `system-ui, sans-serif`), loaded with `next/font`.
**Mono Font:** Geist Mono (fallback `ui-monospace, Menlo, monospace`).

**Character:** One technical-but-warm sans for every word, one mono for every figure. The pairing
reads like a well-set receipt: plain language, exact numbers.

### Hierarchy
- **Amount** (Geist Mono 500, 2rem, line-height 1.1, tabular): the money on the Holding Slip and
  the Trust Link. Always with the currency code in label style after it: `40.00 USD`.
- **Headline** (600, 1.5rem, 1.2): one per screen; the deal title or the screen's job.
- **Title** (600, 1.125rem, 1.35): section headings (Evidence, Audit report, Timeline).
- **Body** (400, 1rem, 1.55): all prose. Max 65ch. 16 px minimum on mobile so iOS never zooms
  into inputs.
- **Label** (500, 0.8125rem, 1.3): form labels, stamps, table headers, button text at small size.
  Sentence case. No all-caps except the photo slot letters A, B, C, D.
- **Data** (Geist Mono 400, 0.875rem, tabular): tracking numbers, weights, dates read from the
  guide, PayPal IDs, SHA-256 hashes (truncated with a copy button).

Scale is fixed rem, ratio about 1.2. No fluid `clamp()` sizes in the app. The landing page may
use one larger headline (2.5rem) and nothing bigger.

### Named Rules
**The Receipt Rule.** Every number that is money, weight, a date read from evidence, or an ID is
set in Geist Mono with tabular figures. Prose numbers ("in 2 days") stay in Geist.

**The No-Serif Rule.** No serif and no display faces anywhere in the product.

## 4. Elevation

Flat by default. Depth comes from tonal layering (Paper, then Sheet, then Kraft for side panels)
and 1 px Rule Line borders, not from shadows. A shadow appears only on things that genuinely
float above the page: popovers, the mobile bottom sheet, toasts, and the AG Grid column menu.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 8px 24px -8px oklch(0.24 0.015 265 / 0.18), 0 1px 2px oklch(0.24 0.015 265 / 0.08)`):
  popovers, sheets, toasts. Tinted toward Ink, never neutral black.

### Named Rules
**The Paper-Stack Rule.** Surfaces at rest are flat. If a card has a shadow and nothing is
floating, remove the shadow. Nested cards are prohibited; group with spacing and rules instead.

## 5. Components

Component vocabulary is shadcn/ui, restyled with the tokens above (never shipped in its default
look). Primitives live in `components/ui/*`; product components in `components/*`. Icons:
`lucide-react` (already a shadcn dependency), stroke width 1.75 everywhere, 16 px inline and
20 px in buttons. No emoji anywhere: code, copy, alt text.

Every interactive component defines default, hover, focus-visible, active, disabled, loading and
error. Touch targets are at least 44 px; primary buttons are 48 px tall.

### Buttons
- **Shape:** gently rounded (10 px).
- **Primary:** Postal Ink fill, On Postal Ink text, 48 px tall, label weight 500.
  Hover: Postal Ink Deep. Active: `scale(0.98)`. Focus-visible: 2 px Postal Ink ring with 2 px
  Paper offset. Loading: label stays, a 16 px spinner replaces the leading icon, width does not
  change.
- **Secondary:** Sheet fill, 1 px Rule Line border, Ink text. Hover: Kraft fill.
- **Ghost:** no fill, Postal Ink text. For tertiary actions and "Load sample evidence".
- **Destructive:** Blocked text on Blocked Wash, used only for "Refund buyer" and "Reject".
- **Money-moving actions** (Release, Refund, Confirm receipt) use an **inline two-step confirm**,
  not a modal: the button expands in place into "Release 40.00 USD to Marta R.?" with Confirm and
  Cancel. The amount and recipient are always repeated.

### State Stamps (chips)
- **Style:** small rubber-stamp pill: 6 px radius, 1 px border in the tone color, tone wash fill,
  tone text, Label type, leading 16 px icon. Labels and tones come only from
  `lib/state-machine/presentation.ts`.
- **Tones:** neutral (awaiting payment), postal ink (funds held, auditing, shipped, payout or
  refund pending), flagged (disputed, escalated), cleared (released), blocked (evidence rejected,
  refunded).
- **Change:** when a state changes, the new stamp lands with a 200 ms `scale(1.06) to 1` plus fade.

### Cards / Containers
- **Corner Style:** 14 px for the Holding Slip and evidence groups; 10 px for inner elements.
- **Background:** Sheet on Paper. Side and secondary panels use Kraft.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1 px Rule Line.
- **Internal Padding:** 24 px on the Holding Slip, 16 px elsewhere.

### Inputs / Fields
- **Style:** Sheet fill, 1 px Rule Line stroke, 10 px radius, 48 px tall, 16 px text.
  Label above the field, helper text below in Ink Muted, error text below in Blocked with an icon.
- **Focus:** stroke becomes Postal Ink plus the 2 px focus ring.
- **Error / Disabled:** Blocked stroke and message; disabled is Kraft fill with Ink Muted text.
- **Amount field:** Geist Mono, `inputmode="decimal"`, `USD` suffix inside the field, inline
  inline validation. Never print an amount range in the UI.

### Navigation
- **Mobile:** a 56 px top bar on Paper with a 1 px bottom Rule Line: product name on the left,
  current role on the right. No hamburger menus for two or three destinations; use the role
  switcher.
- **Desktop mediator:** a slim left column (queue, cases) on Kraft, content on Paper.
- **Role Switcher (demo only):** a fixed Kraft pill at the bottom of the viewport with three
  segments (Buyer, Seller, Mediator); the active one is Postal Ink. Sits above the safe-area inset.
  Hidden when `DEMO_MODE` is off.

### Holding Slip (signature component)
The top of every deal screen, styled like a postal counter slip. Left: the amount in Amount type.
Right: the State Stamp. Below, separated by a dashed 1 px Rule Line: one sentence saying who acts
next and what happens if they don't ("Waiting for the seller's evidence. Auto-refund is not
automatic; a mediator reviews stalled deals."), and the countdown in Data type
("Auto-release in 1d 22h"). Nothing on the screen competes with it.

### Evidence Slot
One per photo: **A** product, **B** product in packing, **C** sealed parcel with the shipping
guide, **D** buyer unboxing. A large slot letter in Label type, a one-line description of what
the photo must show, a ghost example thumbnail, and a capture button
(`accept="image/*" capture="environment"`). After capture: the preview, file size after the
client-side resize to 1536 px, and "Replace". Empty, uploading (progress bar), uploaded, and
rejected states.

### Audit Report
A written record, not a score. Four check rows (product matches listing, product in packing,
parcel sealed with legible guide, guide data readable), each with a cleared / blocked / flagged
icon and one plain sentence. Then the data read from the guide in a two-column Data-type list
(carrier, tracking, weight, date). Then the inconsistencies with reasons, and the triggered rules
as Flagged stamps. While running, the same rows render as skeletons that tick one by one as
Realtime updates arrive ("Reading the shipping guide").

### Mediator Queue (AG Grid)
AG Grid Community with the Quartz theme, its parameters mapped to our tokens: Paper background,
Sheet rows, Rule Line borders, Postal Ink Wash selected row, Geist for text and Geist Mono for the
amount and age columns. Columns: amount, escalation reason (Flagged stamp), case age, state.
Row click opens the case.

## 6. Do's and Don'ts

### Do:
- **Do** open every deal screen with the Holding Slip and keep one primary action per screen.
- **Do** set every amount, weight, tracking number, date from evidence and ID in Geist Mono with
  tabular figures, and always write `USD` after amounts.
- **Do** show the pending state ("Releasing 40.00 USD") until the PayPal webhook confirms it.
  Optimistic UI for money states is forbidden.
- **Do** design every list and async view with its empty, loading (layout-matched skeleton) and
  error state.
- **Do** write UI copy in English, sentence case, active voice, naming the actor and the money:
  "We are holding 40.00 USD until you confirm the parcel arrived."
- **Do** phrase AI findings as observations with evidence: "The guide shows 0.4 kg. This product
  usually weighs 1.2 to 1.6 kg."
- **Do** meet WCAG 2.2 AA contrast, keep focus rings visible, and give every evidence image alt
  text naming its slot ("Photo B: product inside packing").
- **Do** use realistic, varied demo data: names like "Marta Reyes" or "Kofi Mensah", amounts like
  `37.50 USD`, tracking numbers in real carrier formats.

### Don't:
- **Don't** look like **a PayPal clone**: no PayPal blue or yellow, no PayPal logo, no PayPal
  trademarks in our UI or video, beyond the official Checkout button.
- **Don't** build **the generic AI SaaS landing**: no purple or blue-violet gradients, no
  glassmorphism, no gradient text, no rows of three identical icon cards, no hero-metric blocks.
- **Don't** drift into **crypto and web3 aesthetics**: no neon, no glows, no black backgrounds,
  no tickers.
- **Don't** drift into **traditional banking**: no navy and gold, no seals and crests.
- **Don't** use a `border-left` or `border-right` wider than 1 px as a colored accent.
- **Don't** use modals as the first answer. Use inline expansion, a bottom sheet on mobile, or a
  new route. The only dialogs are the PayPal popup and image zoom.
- **Don't** use emoji, pure `#000` or `#fff`, serif or display fonts, or em dashes in UI copy.
- **Don't** show a bare spinner on a blank page, a raw API error, or an AI confidence percentage.
- **Don't** animate layout properties, loop animations forever, or choreograph page loads.
- **Don't** use "Elevate", "Seamless", "Unleash", "Next-gen" or similar filler in copy.
