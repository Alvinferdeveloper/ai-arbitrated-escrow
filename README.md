# Project Shield

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
seed. Run `supabase/seed.sql` once in the Supabase SQL editor (or with `psql`)
to load the demo users, the two Trust Link demo deals and the three mediator
cases. Supabase is optional for browsing: the mediator queue and the Trust Link
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

## Create a deal

1. Open `/seller`.
2. Pick a seeded seller and buyer, write the title, description, price
   (USD, from 1.00) and a delivery estimate (up to 14 days). Deals above
   500 USD always get a mediator's review before shipping (`HIGH_VALUE`).
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

The audit result decides the next state: `SHIPPED` (tracking read from the
guide, auto-release deadline set), `EVIDENCE_REJECTED`, or `ESCALATED` when a
rule fires or the model fails. The seller page and the Trust Link refresh every
few seconds while the audit runs. `/api/cron/retry-audits` (every five minutes
in `vercel.json`, same `CRON_SECRET`) reruns audits whose background run died.

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

`vercel.json` runs that route every five minutes; check that your Vercel plan
allows the schedule. The route processes five deals per call and is safe to
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
validated with Zod, and an invalid reply escalates the deal to a mediator. To
add a vendor with its own SDK, add one entry to `PROVIDERS` in `provider.ts`.

## Test credentials

To be added: sandbox buyer account, demo mode instructions.

## License

MIT, see `LICENSE`.
