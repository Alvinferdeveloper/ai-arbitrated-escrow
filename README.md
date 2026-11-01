# Project Shield

Escrow and AI evidence arbitration for 10 to 100 USD peer-to-peer sales on PayPal.
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
PayPal webhook confirms the money moved.

## Docs

- `PRODUCT.md`: product rules, requirements and priorities
- `DESIGN.md`: design system

## Create a deal

1. Open `/seller`.
2. Pick a seeded seller and buyer, write the title, description, price
   (10 to 100 USD) and a delivery estimate (up to 14 days).
3. Submitting writes the deal through `create_deal` (state `AWAITING_PAYMENT`
   plus the first `events` row) and takes you to the Trust Link at
   `/t/<deal id>`.

The Trust Link reads the real deal once Supabase is configured, including
evidence photos (private bucket, short-lived signed URLs) and the latest
evidence audit. Without Supabase it renders the seeded demo deals.

## PayPal setup

Add the sandbox credentials to `.env.local`:

```bash
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
```

`PAYPAL_WEBHOOK_ID` comes from the PayPal webhook subscription that points at
`/api/paypal/webhook`. The action system can queue releases and refunds; the
settlement runner calls the payouts or refunds API with the same idempotency
key PayPal uses, and the deal only leaves the mediator when PayPal's webhook
confirms the money moved.

## Test credentials

To be added: sandbox buyer account, demo mode instructions.

## License

MIT, see `LICENSE`.
