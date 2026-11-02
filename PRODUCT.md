# PRODUCT.md — Project Shield (working title)

> Product source of truth inside the repo. Contributors working locally may also have the full
> technical spec and an agent manual one folder up (`../`); those are private notes and are not
> versioned. If this file and the spec disagree, the spec wins; fix this file.

The product name is not final. It lives in one constant, `APP_NAME` in `lib/config.ts`.
Never hard-code the name anywhere else. Shortlist: TrustParcel, SafeHandoff, ParcelGuard.

## Register

product

## Brand Personality

**Sober, precise, fair.** Reference feel: Stripe and Wise. The product is a neutral clerk at a
postal counter: it weighs, stamps, records and only then hands over the money. Voice is plain,
calm and specific; it names the actor and the amount and never oversells the AI. The emotional
goal is relief: "someone is keeping the receipt".

## Anti-references

- **A PayPal clone.** No PayPal blue and yellow, no PayPal logo outside the official Checkout
  button, no third-party trademarks in the video (hackathon rule).
- **The generic AI SaaS landing.** Purple gradients, glassmorphism, gradient text, rows of
  identical icon cards, hero-metric blocks.
- **Crypto and web3.** Neon on black, glows, exchange aesthetics.
- **Traditional banking.** Navy and gold, formal and cold.

## Design Principles

1. **Money state first.** Every screen answers "where is the money and who acts next" before
   anything else.
2. **Show the record, not a verdict.** AI output is presented as evidence, findings and the rule
   that fired, never as a score or a bare "approved".
3. **The AI decides, people supervise.** The AI ships, asks for retakes or refunds on its own,
   from validated findings and explicit rules. A person only takes the cases the evidence cannot
   settle (two sides that contradict each other, or a technical failure), and every AI decision
   stays on the record.
4. **One decision per screen.** Buyers and sellers are anxious strangers on a phone; reduce every
   step to one clear action.
5. **The judge is a user.** A judge must walk every role from one URL with no sign-up and no
   explanation from us.

## Accessibility & Inclusion

WCAG 2.2 AA. State is never conveyed by color alone (icon + label). Full keyboard support with
visible focus. Touch targets ≥ 44 px. `prefers-reduced-motion` respected. English copy at a plain
reading level, since many users are non-native English speakers.

## One-line pitch

A 40 USD peer-to-peer scam that nobody can arbitrate today, resolved in 30 seconds:
escrow on PayPal plus an AI evidence audit, with a human mediator for every doubtful case.

## Problem

Peer-to-peer sales (Marketplace, WhatsApp, Instagram) have no trusted middle.
The buyer fears paying and receiving nothing; the seller fears a buyer who lies about the
parcel. Human dispute handling costs more than the sale itself, so nobody arbitrates.

## Solution

1. The seller creates a deal (manual form or a screenshot of the listing) and shares a **Trust Link**.
2. The buyer pays with PayPal Checkout. The money is captured and held by the platform.
3. Before shipping, the seller uploads three photos: **A** product, **B** product inside the packing,
   **C** sealed parcel with the shipping guide.
4. A vision model audits the evidence against the listing, reads the guide (carrier, tracking,
   weight, date) and lists inconsistencies. Explicit rules decide pass, block or escalate.
5. The tracking number is attached to the PayPal transaction.
6. The buyer confirms receipt, or the money auto-releases 48 hours after the delivery estimate.
7. The buyer can open a dispute with unboxing evidence (**D**). The engine releases, refunds, or
   escalates to a human mediator.

## Users and roles

| Role | Goal | Main screens |
| --- | --- | --- |
| Seller | Get paid without being scammed by the buyer | Create deal, upload evidence, deal status |
| Buyer | Pay without risk of receiving nothing | Trust Link `/t/[id]`, pay, confirm or dispute |
| Mediator | Decide the cases the system must not decide alone | AG Grid queue, case detail |
| Judge (demo) | Walk every role from one URL, no sign-up | Role switcher, sample evidence |

## Hard product rules (never break these)

- **USD only, any amount from 1.00 USD.** Deals above 500 USD need a legible serial number or
  model label in photo A (`HIGH_VALUE`). `MAX_DEAL_AMOUNT` is a typo guard, not a product limit, and the
  UI never advertises a range.
- **Delivery estimate at most 14 days.** Auto-release = estimate + 48 h (2 minutes in demo mode).
- **The AI decides, the state machine moves the money.** An AI refund or release is a decision the
  state machine executes through the guarded PayPal action; only PayPal's webhook settles it.
- **Decisions come from rules, not model confidence.** The model reports structured findings; the
  rules turn them into ship, retake, refund or escalate. Nothing branches on a confidence score.
- **Released / Refunded only after the PayPal webhook confirms it.** Before that the deal is
  payout-pending or refund-pending.
- **If the AI fails, times out or returns invalid output, it retries once; then a person takes the
  case.** No money moves on a failed call.
- **The seller has 3 days and 3 attempts to send valid evidence** (3 minutes in demo mode); after
  that the AI refunds the buyer.
- **English only** in the interface, README, Devpost text and video.
- **Sandbox only.** No real money, all keys server-side.

## Decision rules

| Rule | Trigger | Decision |
| --- | --- | --- |
| Different item | Photo A shows another kind of product than the listing | AI refunds the buyer |
| Product mismatch | Photo A does not clearly match the listing | AI asks to retake photo A |
| Weight out of range | Guide weight outside the expected range (25% tolerance) | AI asks to retake photo C |
| Unreadable guide | Guide illegible or a required field missing | AI asks to retake photo C |
| High-value deal | Above 500 USD without a legible serial number or model label | AI asks to retake photo A |
| Attempts exhausted / deadline | Third rejection, or no valid evidence in 3 days | AI refunds the buyer |
| Conflicting evidence | Buyer and seller evidence contradict each other in a dispute | A person decides |
| Technical failure | The model fails twice in a row | A person decides |
| Out-of-band reversal | PayPal sends `PAYMENT.CAPTURE.REVERSED` | A person decides |

Thresholds live in `lib/agents/rules.config.ts` and are tuned with the eval set.

## Functional requirements and priority

| ID | Requirement | Priority |
| --- | --- | --- |
| FR1 | Create a deal from a listing screenshot (AI extracts title, price, description) or a manual form, any USD amount | Must |
| FR2 | Generate a shareable Trust Link | Must |
| FR3 | Buyer pays with PayPal Checkout; payment captured into the platform account | Must |
| FR4 | Seller uploads photos A, B, C and a delivery estimate ≤ 14 days | Must |
| FR5 | AI audits evidence, lists inconsistencies, approves or blocks shipping | Must |
| FR6 | Tracking number from the guide attached via PayPal shipment tracking | Must |
| FR7 | Buyer confirms receipt, or auto-release 48 h after the estimate | Must |
| FR13 | Demo mode: role switcher, sample evidence, shortened timers | Must |
| FR8 | Buyer opens a dispute with unboxing evidence until auto-release time | Should |
| FR9 | Arbitration engine pays out or refunds when no escalation rule fires | Should |
| FR10 | Otherwise the deal appears in the mediator queue | Should |
| FR11 | Mediator releases, refunds or requests more evidence | Should |
| FR12 | All parties see the deal state in real time (Supabase Realtime) | Nice |
| — | 24-case eval with visible metrics in the pitch | Nice |

**Cut:** carrier tracking APIs, multiple countries or currencies, real authentication,
importing listings by Facebook Marketplace link.

## Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR1 | Verify every PayPal webhook signature; answer 200 immediately, process after |
| NFR2 | Idempotency key on every PayPal call; never trust payment state from the client |
| NFR3 | Supabase RLS: each party sees only its deals; signed URLs for every image |
| NFR4 | Validate all AI output with Zod; on failure → human |
| NFR5 | Only the state machine calls PayPal |
| NFR6 | Audit result visible in < 20 s, with a progress indicator |
| NFR7 | Mobile first; photo upload from the phone camera |
| NFR8 | PayPal sandbox only; keys stay on the server |
| NFR9 | Per-session limit on AI calls |
| NFR10 | Everything in English |

## Demo mode

- Fixed role switcher: Buyer / Seller / Mediator (seeded users, no sign-up).
- Sample evidence buttons: honest shipment, wrong weight, different product.
- `DEMO_MODE=true` shortens auto-release to 2 minutes.
- Sandbox buyer credentials shown on screen and in the README.
- Per-session AI call limit.

**Video script (< 3 min):** honest seller → released; fraudulent seller → weight mismatch blocks
shipping; lying buyer → dispute resolved or escalated to the mediator.

## Success metrics for the hackathon

- Stage One pass: fits theme and uses PayPal APIs (Orders, Payouts, Refunds, Webhooks, Tracking).
- Eval run: accuracy and escalation rate over 24 cases, quoted honestly in the pitch.
- A judge can complete all three scenarios from the hosted URL without asking us anything.

## Deadline

Hard: **Nov 12, 2026, 12:00 PM Pacific** (2:00 PM Managua). Internal target: **Nov 11, 2:00 PM Managua.**

## Known limitations (state them openly)

- A photo can be AI-generated or reused. We store SHA-256 and EXIF to detect reuse only.
- The MVP holds funds in the platform balance (sandbox). Production would use PayPal delayed
  disbursement so funds never sit in our balance.
