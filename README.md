# Evenhand

Escrow and AI evidence arbitration for peer-to-peer sales on PayPal.
Built for the PayPal AI Hackathon. Sandbox only: no real money moves.

> Working title. The final name is set in `lib/config.ts`.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # fill PayPal sandbox, Supabase and AI keys
pnpm dev                     # http://localhost:3000
```

## Supabase

```bash
pnpm supabase link --project-ref <project-ref>
pnpm supabase db push
```

`db push` applies the SQL in `supabase/migrations/` but does not run the demo
seed. Run `supabase/seed.sql` in the Supabase SQL editor (or with `psql`) to
load the demo users and five example deals: shipped, evidence rejected, and
three mediator cases (conflicting evidence, a payment reversed outside the deal,
an AI review that failed twice). Example deals are read-only snapshots: their
captures are placeholders, a database guard stops their state and any payout or
refund, and the screens show no deadline and no actions. The script is safe to
run again; it rewrites the example rows and leaves real deals alone.

Supabase is optional for browsing: the mediator queue and the Trust Link
fall back to the local demo data until credentials are set. Creating deals,
uploading evidence and sending money require it.

The mediator actions call the state machine. Requesting evidence moves the deal
back to the seller or buyer and writes an `events` row. A release or refund
writes a pending `payments` row and leaves the deal with the mediator until the
PayPal webhook confirms the money moved. A case escalated before the parcel
left (for example `HIGH_VALUE` or an unreadable guide) offers **Approve
shipping** instead of a release: the deal moves to `SHIPPED` through
`ship_deal`, which stores the guide's tracking and the auto-release deadline.

## Docs

- `PRODUCT.md`: product rules, requirements and priorities
- `DESIGN.md`: design system

## Demo navigation

There is no sign-in. `/deals` lists every deal in the sandbox, and each deal
screen has a **View as** switcher (Buyer, Seller, Mediator) so one person can
walk all sides of the same deal.

## Create a deal

1. Open `/seller`. Optionally start from a screenshot of the listing: the
   browser resizes it and `/api/deals/extract` asks the vision model for the
   title, price and description, which fill the form. Nothing is stored, a
   price in another currency is left for the seller to enter in USD, and the
   route allows five screenshots per minute per IP.
2. Pick a seeded seller and buyer, write the title, description, price
   (USD, from 1.00) and a delivery estimate (up to 14 days). Deals above
   500 USD need a legible serial number or model label in photo A.
3. Submitting writes the deal through `create_deal` (state `AWAITING_PAYMENT`
   plus the first `events` row) and takes you to the seller page at
   `/seller/<deal id>`, which links the Trust Link at `/t/<deal id>`.

The Trust Link reads the real deal once Supabase is configured, including
evidence photos (private bucket, short-lived signed URLs) and the latest
evidence audit. Without Supabase it renders the seeded demo deals.

## Seller evidence and AI audit

Once the deal is `FUNDS_HELD` (or `EVIDENCE_REJECTED`), `/seller/<deal id>`
asks for photos A, B and C. The browser reads each photo's EXIF, resizes it to
1536 px and posts the three to `/api/evidence/<deal id>`. The route sniffs the
real image type, hashes each file (SHA-256), stores it in the private
`evidence` bucket and calls `submit_evidence`, which records the photos, opens
a `PENDING` audit and moves the deal to `AUDITING` in one transaction. It
answers right away; the model call runs in `after()`.

The AI decides the outcome on its own; explicit rules in `lib/agents/rules.ts`
turn its validated findings into one of these:

| Finding | Decision |
| --- | --- |
| Everything checks out | `SHIPPED`: tracking read from the guide, auto-release deadline set |
| A fixable problem (product not shown clearly, not sealed, guide unreadable, weight that does not fit, missing serial on a high-value deal) | `EVIDENCE_REJECTED` with one instruction per photo to retake |
| Photo A shows another kind of product altogether | `REFUNDING`: the AI cancels and refunds the buyer |
| The third rejected upload | `REFUNDING` |
| The model fails twice in a row | `ESCALATED` to a person, the only pre-shipment case that reaches one |

### Fraud checks

Besides the model's findings, the rules run checks that a scammer with stolen
or recycled photos cannot pass. Each one asks for a specific retake, never a
refund on its own:

| Check | Rule | How |
| --- | --- | --- |
| Handwritten verification code in photos A and C | `VERIFICATION_CODE` | Every deal gets a random 4-character code (no 0/O, 1/I/L). The model transcribes any handwritten code it sees without being told the expected one; the rules compare. |
| Guide printed before the deal | `GUIDE_PREDATES_DEAL` | The model returns the guide date as `YYYY-MM-DD` (null if day and month are ambiguous). |
| Tracking number does not fit the carrier | `TRACKING_FORMAT` | Public formats for UPS, USPS, FedEx and DHL; other carriers are not checked. |
| Photo already used in another deal | `REUSED_PHOTO` | Same SHA-256 in another deal's evidence. |
| Photo taken before the deal | `OLD_PHOTO` | EXIF `DateTimeOriginal`, with one day of slack. Missing EXIF never counts against the seller. |
| Edited photo | `EDITED_PHOTO` | EXIF `Software` names an editor such as Photoshop or Snapseed. |

The audit report lists them as trust checks for both parties.

The seller has `EVIDENCE_DEADLINE_MS` (3 days, 10 minutes in demo mode) from
payment or from the last rejection to send valid photos;
`/api/cron/expire-evidence` refunds the buyer when it passes. A refund the AI
starts waits in `REFUNDING` until PayPal's webhook confirms it; if PayPal
refuses it, the deal goes to a person. `/api/cron/retry-audits` reruns audits
whose background run died.

## Live updates

A trigger on `events` broadcasts every state change on a public Supabase
Realtime channel, `deal:<id>`. The message carries only the new state, so the
anon key never reads a table; the buyer, seller and mediator screens just
re-render from the server. While the system is working (an audit, an
arbitration, a refund or a payment in flight) the screens also poll every few
seconds as a fallback. Needs `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Judge path

In demo mode **How it works** on the landing doubles as the judge guide, **Try a
sample deal** opens the create form with the sample listing filled in
(`/seller?sample=1`), and the Trust Link shows the sandbox buyer to pay with. Set `DEMO_PAYPAL_BUYER_EMAIL` and
`DEMO_PAYPAL_BUYER_PASSWORD` to a sandbox personal account (never a real one).

AI calls are capped per deal (`AI_AUDITS_PER_DEAL`, default 8) and across the
app per hour (`AI_AUDITS_PER_HOUR`, default 60). There is no sign-in, so a
per-visitor limit would be trivial to bypass; uploads past a cap get a 429 and
nothing is stored.

### Sample evidence

With `NEXT_PUBLIC_DEMO_MODE=true` the create-deal form offers **Use the sample
listing**, and on a deal started from it the upload and dispute forms offer **Load
sample evidence**. A deal with its own listing does not: the photos would not
match it. The samples are real photos that go through the same upload and audit;
nothing is faked. Each scenario only shows up once its photos exist:

```
public/demo-evidence/honest/{A,B,C}.jpg             product, product in box, sealed parcel with a legible guide (0.35 kg)
public/demo-evidence/wrong-weight/{A,B,C}.jpg       same A and B, guide shows a weight far too high (3.0 kg)
public/demo-evidence/different-product/{A,B,C}.jpg  A shows another kind of product (for example a mug)
public/demo-evidence/unboxing-item-inside/D.jpg     opened parcel with the item inside (buyer lies)
public/demo-evidence/unboxing-empty/D.jpg           opened parcel, empty (legitimate claim)
```

Photos A and C of every seller scenario must show the code `K7P4`
(`DEMO_SAMPLE_VERIFICATION_CODE`) handwritten on paper. A deal started from the
sample listing is stored with `is_sample` and that code, and skips the
freshness checks (photo age, reuse, guide date), because the samples are shot
once and reused by every demo deal.

The listing they match is `SAMPLE_LISTING` in `demo/sample-evidence.ts`. The
audit compares the guide weight with the model's estimate for the product with
its box at a 25% tolerance. The sample listing states about 0.35 kg packed, so the
honest guide must show 0.35 kg.

## Eval

`pnpm eval` runs 12 cases (`evals/cases.ts`) through the production audit,
arbitration and rules with the real model. It stops before the state machine, so
it creates no deals and calls no PayPal API. It needs the `AI_*` variables and
the sample photos; a case whose photos are missing is reported as skipped.

```bash
pnpm eval                             # every case, once
pnpm eval --repeat 3                  # the model is not deterministic
pnpm eval --only wrong-weight         # one case
pnpm eval --photos path/to/photos     # another photo folder
```

It reports fraud let through, honest deals stopped, wrong steps, technical
failures and cases sent to a person, and writes `evals/results/latest.json`.
Keep sample photos at most 1536 px on the long side, as uploads are. Photo A of
the honest set must not show a legible serial number, or `high-value-without-serial`
has nothing to catch.

## Disputes

On a `SHIPPED` deal the buyer can open **Something is wrong with the parcel**
before the auto-release deadline (not after a confirmed receipt). They write
what is wrong and send photo D, the opened parcel. `/api/disputes/<deal id>`
opens the dispute (`DISPUTED`), stores the photo and moves the deal to
`ARBITRATING` with a `PENDING` arbitration. In `after()` the model compares
photo D with the seller's photos and audit, and the rules decide:

- the buyer's photo matches the seller's evidence: payout to the seller;
- both sides agree the item is wrong: refund to the buyer;
- the evidence contradicts itself or is unclear: `ESCALATED` to a mediator.

A release or refund only queues the payment row; the deal leaves
`ARBITRATING` when PayPal's webhook confirms the money moved. A mediator who
asks the buyer for more evidence sends the deal back to `DISPUTED`, where the
buyer can send a new photo D.

## Buyer checkout

On a Trust Link whose deal is `AWAITING_PAYMENT`, the buyer presses **Pay with
PayPal**. The server creates an Orders v2 order (`CAPTURE`, amount read from the
deal row), stores its id on the `payments` row, and redirects to PayPal.

After approval PayPal returns to `/api/paypal/capture/<deal id>`. That route
captures the order and marks the payment `PENDING`; the deal becomes
`FUNDS_HELD` only when the `PAYMENT.CAPTURE.COMPLETED` webhook arrives. If the
webhook cannot reach your machine, the Trust Link stays on "waiting for PayPal";
use a tunnel (ngrok, cloudflared) and point the webhook at
`https://<tunnel>/api/paypal/webhook`.

## Shipment tracking

When a deal reaches `SHIPPED` (AI pass or mediator approval), the guide's
carrier and tracking number are added to the buyer's capture with Orders v2
`POST /v2/checkout/orders/{id}/track` (`notify_payer: true`). Known carriers map
to PayPal's enum (`UPS`, `FEDEX`, `DHL`, `USPS`, Central American posts);
anything else is sent as `OTHER` with `carrier_name_other`. Tracking is
informational: a failure never changes the deal or moves money. It is stored in
`deals.tracking_error` and retried by `/api/cron/auto-release`, up to five
attempts.

## Release and auto-release

On a `SHIPPED` deal the buyer presses **Confirm receipt**. That queues a
`PAYOUT` row and sends the Payouts batch to the seller's PayPal email. The deal
stays `SHIPPED` until `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` confirms the transfer.
If the buyer does nothing, `/api/cron/auto-release` releases every shipped deal
whose `auto_release_at` has passed.

```bash
CRON_SECRET=...
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/auto-release
```

Vercel Hobby only allows daily crons and GitHub drops most scheduled runs, so
call the cron routes from an external scheduler such as cron-job.org:
`expire-evidence` and `auto-release` every minute, `retry-audits` every five,
each a GET with the header `Authorization: Bearer <CRON_SECRET>`. The daily
`vercel.json` crons and `.github/workflows/cron.yml` (secrets `APP_URL` and
`CRON_SECRET`, runnable by hand from the Actions tab) are backstops. The route processes five deals per call and is safe to
call twice: the payout row and its idempotency key are reused.

## PayPal setup

Add the sandbox credentials to `.env.local`:

```bash
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
APP_URL=                   # optional; the public origin for return URLs
```

`APP_URL` is optional locally (the app derives the origin from the request) and
should be set on Vercel. `PAYPAL_WEBHOOK_ID` comes from the PayPal webhook
subscription that points at `/api/paypal/webhook`. The action system can queue
releases and refunds; the settlement runner calls the payouts or refunds API
with the same idempotency key PayPal uses, and the deal only leaves the mediator
when PayPal's webhook confirms the money moved.

## AI model

The evidence audit and the dispute arbitration call one vision model through
the Vercel AI SDK. The vendor is not fixed: `lib/agents/provider.ts` builds the
model from the environment, and any endpoint that speaks the OpenAI Chat
Completions API with image input works (OpenAI, OpenRouter, Groq, Together, a
local Ollama or vLLM, ...).

```bash
AI_PROVIDER=openai-compatible        # the only provider wired today
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=...
AI_MODEL=...                         # a model id that accepts images
AI_STRUCTURED_OUTPUTS=true           # false if the endpoint rejects json_schema
```

With `AI_STRUCTURED_OUTPUTS=false` the request uses `json_object` mode and the
JSON Schema is written into the system prompt instead. Either way the reply is
validated with Zod; an invalid reply is retried once, then the deal goes to a person. To
add a vendor with its own SDK, add one entry to `PROVIDERS` in `provider.ts`.

## Test credentials

To be added: sandbox buyer account, demo mode instructions.

## License

MIT, see `LICENSE`.
