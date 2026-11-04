-- Example deals: read-only snapshots of one step each, for the landing page,
-- the Trust Link and the mediator queue. Fixed ids match demo/data.ts and
-- demo/mediation.ts, so the same screens work with or without Supabase.
--
-- Safe to run again: it rewrites the example rows in place and leaves every
-- real deal alone. Run it once in the Supabase SQL editor after the
-- migrations. Captures are placeholders (DEMO-...), so these deals never move
-- money; the example_deal guards in the migrations enforce it.

select set_config('app.seeding', 'on', false);

insert into public.users (id, role, display_name, paypal_email, is_demo) values
  ('a1111111-1111-4111-8111-111111111111', 'seller', 'Marta Reyes', 'marta.reyes@example.com', true),
  ('a2222222-2222-4222-8222-222222222222', 'buyer', 'Kofi Mensah', null, true),
  ('a3333333-3333-4333-8333-333333333333', 'mediator', 'Ana Solis', null, true),
  ('a4444444-4444-4444-8444-444444444444', 'seller', 'Diego Vargas', 'diego.vargas@example.com', true),
  ('a5555555-5555-4555-8555-555555555555', 'buyer', 'Priya Nair', null, true)
on conflict (id) do update set
  role = excluded.role,
  display_name = excluded.display_name,
  paypal_email = excluded.paypal_email,
  is_demo = excluded.is_demo;

-- Children first, so the rows below are always the current version.
delete from public.events where deal_id in (
  'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444',
  'b5555555-5555-4555-8555-555555555555'
);
delete from public.ai_audits where deal_id in (
  'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444',
  'b5555555-5555-4555-8555-555555555555'
);
delete from public.disputes where deal_id in (
  'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444',
  'b5555555-5555-4555-8555-555555555555'
);
delete from public.evidence where deal_id in (
  'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444',
  'b5555555-5555-4555-8555-555555555555'
);
delete from public.payments where deal_id in (
  'b1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
  'b3333333-3333-4333-8333-333333333333', 'b4444444-4444-4444-8444-444444444444',
  'b5555555-5555-4555-8555-555555555555'
);

insert into public.deals (
  id, seller_id, buyer_id, title, description, price_cents, state,
  delivery_estimate_days, carrier, tracking_number, shipped_at, auto_release_at,
  verification_code, is_sample, is_example, created_at, updated_at
) values
  (
    'b1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    'Wireless over-ear headphones, black',
    'Used for a year, no cracks. Includes the case, cable and original box.',
    3750, 'SHIPPED', 3, 'National Post', 'NP4821773019',
    now() - interval '2 hours 40 minutes', now() + interval '46 hours',
    'H4XR', false, true, now() - interval '3 hours', now() - interval '2 hours 40 minutes'
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'a4444444-4444-4444-8444-444444444444',
    'a2222222-2222-4222-8222-222222222222',
    'Handheld game console, white',
    'New, opened once to check the screen. Dock and cables included.',
    9500, 'EVIDENCE_REJECTED', 4, null, null, null, null,
    'M7KQ', false, true, now() - interval '3 hours', now() - interval '2 hours 40 minutes'
  ),
  (
    'b3333333-3333-4333-8333-333333333333',
    'a1111111-1111-4111-8111-111111111111',
    'a5555555-5555-4555-8555-555555555555',
    'Mirrorless camera body, 24 MP',
    'Body only, 12,000 shutter count. Includes battery and charger.',
    8500, 'ESCALATED', 5, 'National Post', 'NP7854321098',
    now() - interval '47 hours', null,
    'R2DW', false, true, now() - interval '50 hours', now() - interval '6 hours 12 minutes'
  ),
  (
    'b4444444-4444-4444-8444-444444444444',
    'a4444444-4444-4444-8444-444444444444',
    'a5555555-5555-4555-8555-555555555555',
    'Handheld gaming PC, 512 GB',
    'Includes the carrying case and dock. Tested before shipping.',
    10000, 'ESCALATED', 4, 'City Courier', 'CC19876543',
    now() - interval '46 hours', null,
    'P9TB', false, true, now() - interval '50 hours', now() - interval '28 hours'
  ),
  (
    'b5555555-5555-4555-8555-555555555555',
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    'Mechanical keyboard, brown switches',
    'Brown switches, PBT keycaps and USB-C cable included.',
    4500, 'ESCALATED', 3, 'National Post', 'NP9400112233',
    now() - interval '75 hours', null,
    'W3NF', false, true, now() - interval '80 hours', now() - interval '26 hours'
  )
on conflict (id) do update set
  seller_id = excluded.seller_id,
  buyer_id = excluded.buyer_id,
  title = excluded.title,
  description = excluded.description,
  price_cents = excluded.price_cents,
  state = excluded.state,
  delivery_estimate_days = excluded.delivery_estimate_days,
  carrier = excluded.carrier,
  tracking_number = excluded.tracking_number,
  shipped_at = excluded.shipped_at,
  auto_release_at = excluded.auto_release_at,
  verification_code = excluded.verification_code,
  is_sample = excluded.is_sample,
  is_example = excluded.is_example,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into public.payments (
  id, deal_id, purpose, status, amount_cents, paypal_order_id,
  paypal_capture_id, idempotency_key, created_at
) values
  ('c1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111', 'CAPTURE', 'COMPLETED', 3750, 'DEMO-ORDER-HEADPHONES', 'DEMO-CAPTURE-HEADPHONES', 'seed-capture-headphones-0001', now() - interval '3 hours'),
  ('c2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'CAPTURE', 'COMPLETED', 9500, 'DEMO-ORDER-CONSOLE', 'DEMO-CAPTURE-CONSOLE', 'seed-capture-console-0001', now() - interval '3 hours'),
  ('c3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333', 'CAPTURE', 'COMPLETED', 8500, 'DEMO-ORDER-CAMERA', 'DEMO-CAPTURE-CAMERA', 'seed-capture-camera-0001', now() - interval '50 hours'),
  ('c4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444', 'CAPTURE', 'REVERSED', 10000, 'DEMO-ORDER-GAMING-PC', 'DEMO-CAPTURE-GAMING-PC', 'seed-capture-gaming-pc-0001', now() - interval '50 hours'),
  ('c5555555-5555-4555-8555-555555555555', 'b5555555-5555-4555-8555-555555555555', 'CAPTURE', 'COMPLETED', 4500, 'DEMO-ORDER-KEYBOARD', 'DEMO-CAPTURE-KEYBOARD', 'seed-capture-keyboard-0001', now() - interval '80 hours');

insert into public.evidence (
  id, deal_id, type, uploaded_by, storage_path, sha256, mime_type,
  size_bytes, width, height, created_at
) values
  ('d1111111-1111-4111-8111-111111111101', 'b1111111-1111-4111-8111-111111111111', 'A', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/A-seed.jpg', repeat('11', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d1111111-1111-4111-8111-111111111102', 'b1111111-1111-4111-8111-111111111111', 'B', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/B-seed.jpg', repeat('22', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d1111111-1111-4111-8111-111111111103', 'b1111111-1111-4111-8111-111111111111', 'C', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/C-seed.jpg', repeat('33', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '2 hours 50 minutes'),

  ('d2222222-2222-4222-8222-222222222201', 'b2222222-2222-4222-8222-222222222222', 'A', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/A-seed.jpg', repeat('44', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d2222222-2222-4222-8222-222222222202', 'b2222222-2222-4222-8222-222222222222', 'B', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/B-seed.jpg', repeat('55', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d2222222-2222-4222-8222-222222222203', 'b2222222-2222-4222-8222-222222222222', 'C', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/C-seed.jpg', repeat('66', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '2 hours 50 minutes'),

  ('d3333333-3333-4333-8333-333333333301', 'b3333333-3333-4333-8333-333333333333', 'A', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/A-seed.jpg', repeat('a1', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333302', 'b3333333-3333-4333-8333-333333333333', 'B', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/B-seed.jpg', repeat('b2', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333303', 'b3333333-3333-4333-8333-333333333333', 'C', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/C-seed.jpg', repeat('c3', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333304', 'b3333333-3333-4333-8333-333333333333', 'D', 'a5555555-5555-4555-8555-555555555555', 'b3333333-3333-4333-8333-333333333333/D-seed.jpg', repeat('d4', 32), 'image/jpeg', 230000, 1600, 1200, now() - interval '7 hours'),

  ('d4444444-4444-4444-8444-444444444401', 'b4444444-4444-4444-8444-444444444444', 'A', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/A-seed.jpg', repeat('e5', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '47 hours'),
  ('d4444444-4444-4444-8444-444444444402', 'b4444444-4444-4444-8444-444444444444', 'B', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/B-seed.jpg', repeat('f6', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '47 hours'),
  ('d4444444-4444-4444-8444-444444444403', 'b4444444-4444-4444-8444-444444444444', 'C', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/C-seed.jpg', repeat('a7', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '47 hours'),

  ('d5555555-5555-4555-8555-555555555501', 'b5555555-5555-4555-8555-555555555555', 'A', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/A-seed.jpg', repeat('c9', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555502', 'b5555555-5555-4555-8555-555555555555', 'B', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/B-seed.jpg', repeat('da', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555503', 'b5555555-5555-4555-8555-555555555555', 'C', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/C-seed.jpg', repeat('eb', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555504', 'b5555555-5555-4555-8555-555555555555', 'D', 'a2222222-2222-4222-8222-222222222222', 'b5555555-5555-4555-8555-555555555555/D-seed.jpg', repeat('fc', 32), 'image/jpeg', 230000, 1600, 1200, now() - interval '30 hours');

-- Same findings as demo/data.ts and demo/mediation.ts.
insert into public.ai_audits (
  id, deal_id, kind, status, model, prompt_version, result,
  inconsistencies, triggered_rules, started_at, completed_at, created_at, updated_at
) values
  (
    'e1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111',
    'EVIDENCE_AUDIT', 'DONE', 'example', 'evidence-audit-v3',
    $json${
      "product": {"matchesListing": true, "differentItem": false, "identifierVisible": false, "expectedWeightKg": 0.7, "reason": "The black over-ear headphones in photo A match the model and condition in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the same headphones inside the box with the case and cable."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows the closed parcel and the whole shipping guide."},
      "guide": {"readable": true, "carrier": "National Post", "trackingNumber": "NP4821773019", "weightKg": 0.8, "date": "2026-11-02", "dateIso": "2026-11-02"},
      "verification": {"codeInPhotoA": "H4XR", "codeInPhotoC": "H4XR"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '2 hours 45 minutes', now() - interval '2 hours 40 minutes',
    now() - interval '2 hours 45 minutes', now() - interval '2 hours 40 minutes'
  ),
  (
    'e2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222',
    'EVIDENCE_AUDIT', 'DONE', 'example', 'evidence-audit-v3',
    $json${
      "product": {"matchesListing": true, "differentItem": false, "identifierVisible": false, "expectedWeightKg": 1.4, "reason": "Photo A shows a white handheld console with both controllers, as in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the console, dock and cables inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows a sealed parcel and a full guide."},
      "guide": {"readable": true, "carrier": "City Courier", "trackingNumber": "CC55201984", "weightKg": 0.4, "date": "2026-11-02", "dateIso": "2026-11-02"},
      "verification": {"codeInPhotoA": "M7KQ", "codeInPhotoC": "M7KQ"},
      "inconsistencies": ["The guide records 0.4 kg. This console with its dock and packing usually weighs 1.2 to 1.6 kg."]
    }$json$::jsonb,
    '["The guide records 0.4 kg. This console with its dock and packing usually weighs 1.2 to 1.6 kg."]'::jsonb,
    array['WEIGHT_OUT_OF_RANGE']::text[],
    now() - interval '2 hours 45 minutes', now() - interval '2 hours 40 minutes',
    now() - interval '2 hours 45 minutes', now() - interval '2 hours 40 minutes'
  ),
  (
    'e3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333',
    'EVIDENCE_AUDIT', 'DONE', 'example', 'evidence-audit-v3',
    $json${
      "product": {"matchesListing": true, "differentItem": false, "identifierVisible": true, "expectedWeightKg": 1.9, "reason": "Photo A shows the camera body with the serial number on the base, as in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the camera, battery and charger inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows the parcel sealed with clear tape and the whole guide."},
      "guide": {"readable": true, "carrier": "National Post", "trackingNumber": "NP7854321098", "weightKg": 1.9, "date": "2026-10-31", "dateIso": "2026-10-31"},
      "verification": {"codeInPhotoA": "R2DW", "codeInPhotoC": "R2DW"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '48 hours', now() - interval '47 hours 55 minutes',
    now() - interval '48 hours', now() - interval '47 hours 55 minutes'
  ),
  (
    'e4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444',
    'EVIDENCE_AUDIT', 'DONE', 'example', 'evidence-audit-v3',
    $json${
      "product": {"matchesListing": true, "differentItem": false, "identifierVisible": false, "expectedWeightKg": 0.9, "reason": "Photo A shows the handheld gaming PC and the carrying case in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the console, case and charger inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows a sealed parcel with the whole guide."},
      "guide": {"readable": true, "carrier": "City Courier", "trackingNumber": "CC19876543", "weightKg": 0.9, "date": "2026-10-31", "dateIso": "2026-10-31"},
      "verification": {"codeInPhotoA": "P9TB", "codeInPhotoC": "P9TB"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '47 hours', now() - interval '46 hours 55 minutes',
    now() - interval '47 hours', now() - interval '46 hours 55 minutes'
  ),
  (
    'e5555555-5555-4555-8555-555555555555', 'b5555555-5555-4555-8555-555555555555',
    'EVIDENCE_AUDIT', 'DONE', 'example', 'evidence-audit-v3',
    $json${
      "product": {"matchesListing": true, "differentItem": false, "identifierVisible": false, "expectedWeightKg": 1.1, "reason": "Photo A shows the mechanical keyboard and its keycaps as described."},
      "packing": {"productInside": true, "reason": "Photo B shows the keyboard and cable inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows the sealed parcel and a legible guide."},
      "guide": {"readable": true, "carrier": "National Post", "trackingNumber": "NP9400112233", "weightKg": 1.1, "date": "2026-10-30", "dateIso": "2026-10-30"},
      "verification": {"codeInPhotoA": "W3NF", "codeInPhotoC": "W3NF"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '77 hours', now() - interval '76 hours 55 minutes',
    now() - interval '77 hours', now() - interval '76 hours 55 minutes'
  );

insert into public.disputes (id, deal_id, opened_by, reason, status, created_at) values
  (
    'f3333333-3333-4333-8333-333333333333', 'b3333333-3333-4333-8333-333333333333',
    'a5555555-5555-4555-8555-555555555555',
    'The box arrived with a different camera body, and the tape was already cut when it reached me.',
    'OPEN', now() - interval '7 hours'
  ),
  (
    'f5555555-5555-4555-8555-555555555555', 'b5555555-5555-4555-8555-555555555555',
    'a2222222-2222-4222-8222-222222222222',
    'Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping.',
    'OPEN', now() - interval '30 hours'
  );

insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
  -- Headphones: the evidence passed and the parcel is on its way.
  ('b1111111-1111-4111-8111-111111111111', 'system', null, 'AWAITING_PAYMENT', '{"title":"Deal created","detail":"The seller opened the deal and shared the Trust Link with the buyer."}'::jsonb, now() - interval '3 hours 10 minutes'),
  ('b1111111-1111-4111-8111-111111111111', 'paypal', 'AWAITING_PAYMENT', 'FUNDS_HELD', '{"title":"Payment captured","detail":"37.50 USD is held in the platform account."}'::jsonb, now() - interval '3 hours'),
  ('b1111111-1111-4111-8111-111111111111', 'seller', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence sent","detail":"The seller uploaded photos A, B and C. The audit is running."}'::jsonb, now() - interval '2 hours 50 minutes'),
  ('b1111111-1111-4111-8111-111111111111', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Evidence passed","detail":"The audit cleared photos A, B and C and read the shipping guide."}'::jsonb, now() - interval '2 hours 40 minutes'),

  -- Console: the guide weight does not fit, so the AI asked for a new photo C.
  ('b2222222-2222-4222-8222-222222222222', 'system', null, 'AWAITING_PAYMENT', '{"title":"Deal created","detail":"The seller opened the deal and shared the Trust Link with the buyer."}'::jsonb, now() - interval '3 hours 10 minutes'),
  ('b2222222-2222-4222-8222-222222222222', 'paypal', 'AWAITING_PAYMENT', 'FUNDS_HELD', '{"title":"Payment captured","detail":"95.00 USD is held in the platform account."}'::jsonb, now() - interval '3 hours'),
  ('b2222222-2222-4222-8222-222222222222', 'seller', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence sent","detail":"The seller uploaded photos A, B and C. The audit is running."}'::jsonb, now() - interval '2 hours 50 minutes'),
  ('b2222222-2222-4222-8222-222222222222', 'ai', 'AUDITING', 'EVIDENCE_REJECTED', $json${
    "retakes": [{"slot": "C", "instruction": "Retake photo C: the guide weight does not fit this product (about 1.4 kg packed); weigh the parcel again and show the corrected guide."}],
    "triggeredRules": ["WEIGHT_OUT_OF_RANGE"],
    "attempt": 1,
    "attemptsLeft": 2,
    "detail": "Retake photo C: the guide weight does not fit this product (about 1.4 kg packed); weigh the parcel again and show the corrected guide."
  }$json$::jsonb, now() - interval '2 hours 40 minutes'),

  -- Camera: the two sides contradict each other, so a person decides.
  ('b3333333-3333-4333-8333-333333333333', 'system', null, 'AWAITING_PAYMENT', '{"title":"Deal created","detail":"The seller opened the deal and shared the Trust Link with the buyer."}'::jsonb, now() - interval '50 hours 10 minutes'),
  ('b3333333-3333-4333-8333-333333333333', 'paypal', 'AWAITING_PAYMENT', 'FUNDS_HELD', '{"title":"Payment captured","detail":"85.00 USD is held in the platform account."}'::jsonb, now() - interval '50 hours'),
  ('b3333333-3333-4333-8333-333333333333', 'seller', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence sent","detail":"The seller uploaded photos A, B and C. The audit is running."}'::jsonb, now() - interval '48 hours'),
  ('b3333333-3333-4333-8333-333333333333', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Evidence passed","detail":"The audit cleared photos A, B and C and read the shipping guide."}'::jsonb, now() - interval '47 hours'),
  ('b3333333-3333-4333-8333-333333333333', 'buyer', 'SHIPPED', 'DISPUTED', '{"title":"Buyer opened a dispute","detail":"The box arrived with a different camera body, and the tape was already cut when it reached me."}'::jsonb, now() - interval '7 hours'),
  ('b3333333-3333-4333-8333-333333333333', 'buyer', 'DISPUTED', 'ARBITRATING', '{"title":"Unboxing photo sent","detail":"The buyer sent photo D. The arbitration is running."}'::jsonb, now() - interval '6 hours 30 minutes'),
  ('b3333333-3333-4333-8333-333333333333', 'ai', 'ARBITRATING', 'ESCALATED', $json${
    "rule": "CONFLICTING_EVIDENCE",
    "title": "Escalated: conflicting evidence",
    "detail": "Photo C and photo D contradict each other. The money stays held.",
    "reasonDetail": "Photo C and photo D disagree on the parcel tape and the serial number.",
    "summary": "The buyer's unboxing photo shows a different serial number and tape than the seller's sealed parcel. The AI cannot tell who is right, so a person decides.",
    "claim": "The box arrived with a different camera body, and the tape was already cut when it reached me."
  }$json$::jsonb, now() - interval '6 hours 12 minutes'),

  -- Gaming PC: the buyer reversed the payment at PayPal after shipping.
  ('b4444444-4444-4444-8444-444444444444', 'system', null, 'AWAITING_PAYMENT', '{"title":"Deal created","detail":"The seller opened the deal and shared the Trust Link with the buyer."}'::jsonb, now() - interval '50 hours 10 minutes'),
  ('b4444444-4444-4444-8444-444444444444', 'paypal', 'AWAITING_PAYMENT', 'FUNDS_HELD', '{"title":"Payment captured","detail":"100.00 USD is held in the platform account."}'::jsonb, now() - interval '50 hours'),
  ('b4444444-4444-4444-8444-444444444444', 'seller', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence sent","detail":"The seller uploaded photos A, B and C. The audit is running."}'::jsonb, now() - interval '47 hours'),
  ('b4444444-4444-4444-8444-444444444444', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Evidence passed","detail":"The audit cleared photos A, B and C and read the shipping guide."}'::jsonb, now() - interval '46 hours'),
  ('b4444444-4444-4444-8444-444444444444', 'paypal', 'SHIPPED', 'ESCALATED', $json${
    "rule": "OUT_OF_BAND_REVERSAL",
    "title": "Escalated: payment reversed outside the deal",
    "detail": "PayPal reported a reversal of the buyer's payment. The deal stops until a person decides.",
    "reasonDetail": "PayPal reversed the buyer's payment outside the deal, after the parcel had shipped.",
    "summary": "The buyer claimed the payment back through PayPal instead of opening a dispute here. The evidence passed and the parcel shipped, so a person decides what the seller is owed.",
    "claim": "No dispute was opened here. The buyer went straight to PayPal.",
    "source": "paypal-webhook",
    "eventType": "PAYMENT.CAPTURE.REVERSED"
  }$json$::jsonb, now() - interval '28 hours'),

  -- Keyboard: the AI review of the dispute failed twice.
  ('b5555555-5555-4555-8555-555555555555', 'system', null, 'AWAITING_PAYMENT', '{"title":"Deal created","detail":"The seller opened the deal and shared the Trust Link with the buyer."}'::jsonb, now() - interval '80 hours 10 minutes'),
  ('b5555555-5555-4555-8555-555555555555', 'paypal', 'AWAITING_PAYMENT', 'FUNDS_HELD', '{"title":"Payment captured","detail":"45.00 USD is held in the platform account."}'::jsonb, now() - interval '80 hours'),
  ('b5555555-5555-4555-8555-555555555555', 'seller', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence sent","detail":"The seller uploaded photos A, B and C. The audit is running."}'::jsonb, now() - interval '77 hours'),
  ('b5555555-5555-4555-8555-555555555555', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Evidence passed","detail":"The audit cleared photos A, B and C and read the shipping guide."}'::jsonb, now() - interval '75 hours'),
  ('b5555555-5555-4555-8555-555555555555', 'buyer', 'SHIPPED', 'DISPUTED', '{"title":"Buyer opened a dispute","detail":"Two switches are broken and the space bar sticks."}'::jsonb, now() - interval '30 hours'),
  ('b5555555-5555-4555-8555-555555555555', 'buyer', 'DISPUTED', 'ARBITRATING', '{"title":"Unboxing photo sent","detail":"The buyer sent photo D. The arbitration is running."}'::jsonb, now() - interval '29 hours'),
  ('b5555555-5555-4555-8555-555555555555', 'system', 'ARBITRATING', 'ESCALATED', $json${
    "rule": "TECHNICAL_FAILURE",
    "title": "Escalated: technical failure",
    "detail": "The AI review failed twice. The money stays held.",
    "reasonDetail": "The AI review of the dispute failed twice. The retry did not recover.",
    "summary": "The seller's evidence passed, but the AI review of the dispute failed before it could compare both sides. A person reads the photos instead.",
    "claim": "Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping."
  }$json$::jsonb, now() - interval '26 hours');

select set_config('app.seeding', '', false);
