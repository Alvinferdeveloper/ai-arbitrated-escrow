-- Demo data for the buyer/seller screens and the mediator queue. Fixed UUIDs
-- match demo/data.ts and demo/mediation.ts, so the same cases work with or
-- without Supabase. Safe to run more than once: every row is keyed by a fixed
-- id and events are only inserted when the deal has none.

insert into public.users (id, role, display_name, paypal_email, is_demo) values
  ('a1111111-1111-4111-8111-111111111111', 'seller', 'Marta Reyes', 'marta.reyes@example.com', true),
  ('a2222222-2222-4222-8222-222222222222', 'buyer', 'Kofi Mensah', null, true),
  ('a3333333-3333-4333-8333-333333333333', 'mediator', 'Ana Solis', null, true),
  ('a4444444-4444-4444-8444-444444444444', 'seller', 'Diego Vargas', 'diego.vargas@example.com', true),
  ('a5555555-5555-4555-8555-555555555555', 'buyer', 'Priya Nair', null, true)
on conflict (id) do nothing;

insert into public.deals (
  id, seller_id, buyer_id, title, description, price_cents, state,
  delivery_estimate_days, carrier, tracking_number, created_at, updated_at
) values
  (
    'b3333333-3333-4333-8333-333333333333',
    'a1111111-1111-4111-8111-111111111111',
    'a5555555-5555-4555-8555-555555555555',
    'Canon EOS Rebel T7 camera',
    'Body only, 12,000 shutter count. Includes battery and charger.',
    8500, 'ESCALATED', 5, 'FedEx', '785432109876',
    now() - interval '50 hours', now() - interval '6 hours 12 minutes'
  ),
  (
    'b4444444-4444-4444-8444-444444444444',
    'a4444444-4444-4444-8444-444444444444',
    'a5555555-5555-4555-8555-555555555555',
    'Steam Deck OLED, 512 GB',
    'Includes the carrying case and dock. Tested before shipping.',
    10000, 'ESCALATED', 4, 'UPS', '1Z999AA10198765432',
    now() - interval '50 hours', now() - interval '28 hours'
  ),
  (
    'b5555555-5555-4555-8555-555555555555',
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    'Keychron K2 mechanical keyboard',
    'Brown switches, PBT keycaps and USB-C cable included.',
    4500, 'ESCALATED', 3, 'USPS', '9400111899223856123456',
    now() - interval '80 hours', now() - interval '26 hours'
  )
on conflict (id) do nothing;

insert into public.payments (
  id, deal_id, purpose, status, amount_cents, paypal_order_id,
  paypal_capture_id, idempotency_key, created_at
) values
  (
    'c3333333-3333-4333-8333-333333333333',
    'b3333333-3333-4333-8333-333333333333',
    'CAPTURE', 'COMPLETED', 8500, 'DEMO-ORDER-CANON', 'DEMO-CAPTURE-CANON',
    'seed-capture-canon-0001', now() - interval '50 hours'
  ),
  (
    'c4444444-4444-4444-8444-444444444444',
    'b4444444-4444-4444-8444-444444444444',
    'CAPTURE', 'COMPLETED', 10000, 'DEMO-ORDER-STEAM', 'DEMO-CAPTURE-STEAM',
    'seed-capture-steam-0001', now() - interval '50 hours'
  ),
  (
    'c5555555-5555-4555-8555-555555555555',
    'b5555555-5555-4555-8555-555555555555',
    'CAPTURE', 'COMPLETED', 4500, 'DEMO-ORDER-KEYBOARD', 'DEMO-CAPTURE-KEYBOARD',
    'seed-capture-keyboard-0001', now() - interval '80 hours'
  )
on conflict (id) do nothing;

insert into public.evidence (
  id, deal_id, type, uploaded_by, storage_path, sha256, mime_type,
  size_bytes, width, height, created_at
) values
  ('d3333333-3333-4333-8333-333333333301', 'b3333333-3333-4333-8333-333333333333', 'A', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/A-seed.jpg', repeat('a1', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333302', 'b3333333-3333-4333-8333-333333333333', 'B', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/B-seed.jpg', repeat('b2', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333303', 'b3333333-3333-4333-8333-333333333333', 'C', 'a1111111-1111-4111-8111-111111111111', 'b3333333-3333-4333-8333-333333333333/C-seed.jpg', repeat('c3', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '48 hours'),
  ('d3333333-3333-4333-8333-333333333304', 'b3333333-3333-4333-8333-333333333333', 'D', 'a5555555-5555-4555-8555-555555555555', 'b3333333-3333-4333-8333-333333333333/D-seed.jpg', repeat('d4', 32), 'image/jpeg', 230000, 1600, 1200, now() - interval '7 hours'),

  ('d4444444-4444-4444-8444-444444444401', 'b4444444-4444-4444-8444-444444444444', 'A', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/A-seed.jpg', repeat('e5', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '47 hours'),
  ('d4444444-4444-4444-8444-444444444402', 'b4444444-4444-4444-8444-444444444444', 'B', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/B-seed.jpg', repeat('f6', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '47 hours'),
  ('d4444444-4444-4444-8444-444444444403', 'b4444444-4444-4444-8444-444444444444', 'C', 'a4444444-4444-4444-8444-444444444444', 'b4444444-4444-4444-8444-444444444444/C-seed.jpg', repeat('a7', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '47 hours'),
  ('d4444444-4444-4444-8444-444444444404', 'b4444444-4444-4444-8444-444444444444', 'D', 'a5555555-5555-4555-8555-555555555555', 'b4444444-4444-4444-8444-444444444444/D-seed.jpg', repeat('b8', 32), 'image/jpeg', 230000, 1600, 1200, now() - interval '30 hours'),

  ('d5555555-5555-4555-8555-555555555501', 'b5555555-5555-4555-8555-555555555555', 'A', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/A-seed.jpg', repeat('c9', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555502', 'b5555555-5555-4555-8555-555555555555', 'B', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/B-seed.jpg', repeat('da', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555503', 'b5555555-5555-4555-8555-555555555555', 'C', 'a1111111-1111-4111-8111-111111111111', 'b5555555-5555-4555-8555-555555555555/C-seed.jpg', repeat('eb', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '77 hours'),
  ('d5555555-5555-4555-8555-555555555504', 'b5555555-5555-4555-8555-555555555555', 'D', 'a2222222-2222-4222-8222-222222222222', 'b5555555-5555-4555-8555-555555555555/D-seed.jpg', repeat('fc', 32), 'image/jpeg', 230000, 1600, 1200, now() - interval '30 hours')
on conflict (id) do nothing;

insert into public.ai_audits (
  id, deal_id, kind, status, model, prompt_version, result,
  inconsistencies, triggered_rules, started_at, completed_at, created_at, updated_at
) values
  (
    'e3333333-3333-4333-8333-333333333333',
    'b3333333-3333-4333-8333-333333333333',
    'EVIDENCE_AUDIT', 'DONE', 'seed', 'seed-v1',
    $json${
      "product": {"matchesListing": true, "expectedWeightKg": 1.9, "reason": "The camera body matches the listing."},
      "packing": {"productInside": true, "reason": "The camera is inside the box with its battery and charger."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "The parcel is sealed and the guide is readable."},
      "guide": {"readable": true, "carrier": "FedEx", "trackingNumber": "785432109876", "weightKg": 1.9, "date": "2026-10-27"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '48 hours', now() - interval '47 hours 55 minutes',
    now() - interval '48 hours', now() - interval '47 hours 55 minutes'
  ),
  (
    'e4444444-4444-4444-8444-444444444444',
    'b4444444-4444-4444-8444-444444444444',
    'EVIDENCE_AUDIT', 'DONE', 'seed', 'seed-v1',
    $json${
      "product": {"matchesListing": true, "expectedWeightKg": 0.9, "reason": "The Steam Deck and case match the listing."},
      "packing": {"productInside": true, "reason": "The console, case and charger are inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "The parcel is sealed and the guide is readable."},
      "guide": {"readable": true, "carrier": "UPS", "trackingNumber": "1Z999AA10198765432", "weightKg": 0.9, "date": "2026-10-27"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, array['WEIGHT_OUT_OF_RANGE']::text[],
    now() - interval '47 hours', now() - interval '46 hours 55 minutes',
    now() - interval '47 hours', now() - interval '46 hours 55 minutes'
  ),
  (
    'e5555555-5555-4555-8555-555555555555',
    'b5555555-5555-4555-8555-555555555555',
    'EVIDENCE_AUDIT', 'DONE', 'seed', 'seed-v1',
    $json${
      "product": {"matchesListing": true, "expectedWeightKg": 1.1, "reason": "The Keychron K2 matches the listing."},
      "packing": {"productInside": true, "reason": "The keyboard and cable are inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "The parcel is sealed and the guide is readable."},
      "guide": {"readable": true, "carrier": "USPS", "trackingNumber": "9400111899223856123456", "weightKg": 1.1, "date": "2026-10-26"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '77 hours', now() - interval '76 hours 55 minutes',
    now() - interval '77 hours', now() - interval '76 hours 55 minutes'
  )
on conflict (id) do nothing;

insert into public.disputes (
  id, deal_id, opened_by, reason, status, created_at
) values
  (
    'f3333333-3333-4333-8333-333333333333',
    'b3333333-3333-4333-8333-333333333333',
    'a5555555-5555-4555-8555-555555555555',
    'The box arrived with a different camera body, and the tape was already cut when it reached me.',
    'OPEN', now() - interval '7 hours'
  ),
  (
    'f4444444-4444-4444-8444-444444444444',
    'b4444444-4444-4444-8444-444444444444',
    'a5555555-5555-4555-8555-555555555555',
    'The parcel felt too light. The dock and the carrying case were missing from the box.',
    'OPEN', now() - interval '30 hours'
  ),
  (
    'f5555555-5555-4555-8555-555555555555',
    'b5555555-5555-4555-8555-555555555555',
    'a2222222-2222-4222-8222-222222222222',
    'Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping.',
    'OPEN', now() - interval '30 hours'
  )
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from public.events
    where deal_id = 'b3333333-3333-4333-8333-333333333333'
  ) then
    insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
      ('b3333333-3333-4333-8333-333333333333', 'paypal', null, 'FUNDS_HELD', '{"title":"Payment captured","detail":"85.00 USD is held in the platform account."}'::jsonb, now() - interval '50 hours'),
      ('b3333333-3333-4333-8333-333333333333', 'system', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence audit started","detail":"The model checked photos A, B and C."}'::jsonb, now() - interval '49 hours'),
      ('b3333333-3333-4333-8333-333333333333', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Audit completed","detail":"Four checks passed and the guide is readable."}'::jsonb, now() - interval '48 hours'),
      ('b3333333-3333-4333-8333-333333333333', 'buyer', 'SHIPPED', 'DISPUTED', '{"title":"Buyer opened a dispute","detail":"The buyer uploaded photo D and described a different serial number."}'::jsonb, now() - interval '7 hours'),
      ('b3333333-3333-4333-8333-333333333333', 'ai', 'DISPUTED', 'ARBITRATING', '{"title":"Arbitration started","detail":"The model compared both sides of the dispute."}'::jsonb, now() - interval '6 hours 30 minutes'),
      ('b3333333-3333-4333-8333-333333333333', 'ai', 'ARBITRATING', 'ESCALATED', $json${
        "rule": "CONFLICTING_EVIDENCE",
        "title": "Escalated: conflicting evidence",
        "detail": "Photo C and photo D disagree on the parcel tape and the serial number.",
        "reasonDetail": "Photo C and photo D disagree on the parcel tape and the serial number.",
        "summary": "The buyer's unboxing photo shows a different serial number and tape than the seller's sealed parcel. The rule asks for a person.",
        "claim": "The box arrived with a different camera body, and the tape was already cut when it reached me."
      }$json$::jsonb, now() - interval '6 hours 12 minutes');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.events
    where deal_id = 'b4444444-4444-4444-8444-444444444444'
  ) then
    insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
      ('b4444444-4444-4444-8444-444444444444', 'paypal', null, 'FUNDS_HELD', '{"title":"Payment captured","detail":"100.00 USD is held in the platform account."}'::jsonb, now() - interval '50 hours'),
      ('b4444444-4444-4444-8444-444444444444', 'system', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence audit started","detail":"The model checked photos A, B and C."}'::jsonb, now() - interval '48 hours'),
      ('b4444444-4444-4444-8444-444444444444', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Audit passed","detail":"The checks passed and the deal was marked as shipped."}'::jsonb, now() - interval '47 hours'),
      ('b4444444-4444-4444-8444-444444444444', 'buyer', 'SHIPPED', 'DISPUTED', '{"title":"Buyer opened a dispute","detail":"The buyer uploaded photo D and recorded 0.4 kg on a kitchen scale."}'::jsonb, now() - interval '30 hours'),
      ('b4444444-4444-4444-8444-444444444444', 'ai', 'DISPUTED', 'ARBITRATING', '{"title":"Arbitration started","detail":"The model compared the buyer weight with the guide."}'::jsonb, now() - interval '29 hours'),
      ('b4444444-4444-4444-8444-444444444444', 'ai', 'ARBITRATING', 'ESCALATED', $json${
        "rule": "WEIGHT_OUT_OF_RANGE",
        "title": "Escalated: weight out of range",
        "detail": "The buyer weighed the parcel at 0.4 kg. The guide records 0.9 kg.",
        "reasonDetail": "The buyer weighed the parcel at 0.4 kg. The guide records 0.9 kg.",
        "summary": "The parcel arrived much lighter than the guide says. The buyer says the dock and the carrying case were missing.",
        "claim": "The parcel felt too light. The dock and the carrying case were missing from the box."
      }$json$::jsonb, now() - interval '28 hours');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.events
    where deal_id = 'b5555555-5555-4555-8555-555555555555'
  ) then
    insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
      ('b5555555-5555-4555-8555-555555555555', 'paypal', null, 'FUNDS_HELD', '{"title":"Payment captured","detail":"45.00 USD is held in the platform account."}'::jsonb, now() - interval '80 hours'),
      ('b5555555-5555-4555-8555-555555555555', 'system', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence audit started","detail":"The model checked photos A, B and C."}'::jsonb, now() - interval '79 hours'),
      ('b5555555-5555-4555-8555-555555555555', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Audit passed","detail":"The seller evidence passed and the deal was marked as shipped."}'::jsonb, now() - interval '77 hours'),
      ('b5555555-5555-4555-8555-555555555555', 'buyer', 'SHIPPED', 'DISPUTED', '{"title":"Buyer opened a dispute","detail":"The buyer uploaded photo D and described two broken switches."}'::jsonb, now() - interval '30 hours'),
      ('b5555555-5555-4555-8555-555555555555', 'ai', 'DISPUTED', 'ARBITRATING', '{"title":"Arbitration started","detail":"The model could not return a valid comparison."}'::jsonb, now() - interval '29 hours'),
      ('b5555555-5555-4555-8555-555555555555', 'system', 'ARBITRATING', 'ESCALATED', $json${
        "rule": "TECHNICAL_FAILURE",
        "title": "Escalated: technical failure",
        "detail": "The arbitration model returned invalid output twice. The retry did not recover.",
        "reasonDetail": "The arbitration model returned invalid output twice. The retry did not recover.",
        "summary": "The seller's evidence passed, but the automatic dispute review failed before it could compare both sides. A person needs to read the photos.",
        "claim": "Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping."
      }$json$::jsonb, now() - interval '26 hours');
  end if;
end;
$$;

-- Buyer and seller demo deals used by the landing page and the Trust Link.
-- Same ids and content as demo/data.ts, so the same scenarios work with or
-- without Supabase.

insert into public.deals (
  id, seller_id, buyer_id, title, description, price_cents, state,
  delivery_estimate_days, carrier, tracking_number, auto_release_at,
  created_at, updated_at
) values
  (
    'b1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'a2222222-2222-4222-8222-222222222222',
    'Sony WH-1000XM4 headphones',
    'Used for a year, no cracks. Includes the case, cable and original box.',
    3750, 'SHIPPED', 3, 'UPS', '1Z999AA10123456784',
    now() + interval '46 hours',
    now() - interval '3 hours', now() - interval '2 hours'
  ),
  (
    'b2222222-2222-4222-8222-222222222222',
    'a4444444-4444-4444-8444-444444444444',
    'a2222222-2222-4222-8222-222222222222',
    'Nintendo Switch OLED, white',
    'New, opened once to check the screen. Dock and cables included.',
    9500, 'EVIDENCE_REJECTED', 4, null, null, null,
    now() - interval '3 hours', now() - interval '2 hours'
  )
on conflict (id) do nothing;

insert into public.payments (
  id, deal_id, purpose, status, amount_cents, paypal_order_id,
  paypal_capture_id, idempotency_key, created_at
) values
  (
    'c1111111-1111-4111-8111-111111111111',
    'b1111111-1111-4111-8111-111111111111',
    'CAPTURE', 'COMPLETED', 3750, 'DEMO-ORDER-HEADPHONES', 'DEMO-CAPTURE-HEADPHONES',
    'seed-capture-headphones-0001', now() - interval '3 hours'
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'b2222222-2222-4222-8222-222222222222',
    'CAPTURE', 'COMPLETED', 9500, 'DEMO-ORDER-SWITCH', 'DEMO-CAPTURE-SWITCH',
    'seed-capture-switch-0001', now() - interval '3 hours'
  )
on conflict (id) do nothing;

insert into public.evidence (
  id, deal_id, type, uploaded_by, storage_path, sha256, mime_type,
  size_bytes, width, height, created_at
) values
  ('d1111111-1111-4111-8111-111111111101', 'b1111111-1111-4111-8111-111111111111', 'A', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/A-seed.jpg', repeat('11', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d1111111-1111-4111-8111-111111111102', 'b1111111-1111-4111-8111-111111111111', 'B', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/B-seed.jpg', repeat('22', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d1111111-1111-4111-8111-111111111103', 'b1111111-1111-4111-8111-111111111111', 'C', 'a1111111-1111-4111-8111-111111111111', 'b1111111-1111-4111-8111-111111111111/C-seed.jpg', repeat('33', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '2 hours 50 minutes'),

  ('d2222222-2222-4222-8222-222222222201', 'b2222222-2222-4222-8222-222222222222', 'A', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/A-seed.jpg', repeat('44', 32), 'image/jpeg', 210000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d2222222-2222-4222-8222-222222222202', 'b2222222-2222-4222-8222-222222222222', 'B', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/B-seed.jpg', repeat('55', 32), 'image/jpeg', 205000, 1600, 1200, now() - interval '2 hours 50 minutes'),
  ('d2222222-2222-4222-8222-222222222203', 'b2222222-2222-4222-8222-222222222222', 'C', 'a4444444-4444-4444-8444-444444444444', 'b2222222-2222-4222-8222-222222222222/C-seed.jpg', repeat('66', 32), 'image/jpeg', 220000, 1600, 1200, now() - interval '2 hours 50 minutes')
on conflict (id) do nothing;

insert into public.ai_audits (
  id, deal_id, kind, status, model, prompt_version, result,
  inconsistencies, triggered_rules, started_at, completed_at, created_at, updated_at
) values
  (
    'e1111111-1111-4111-8111-111111111111',
    'b1111111-1111-4111-8111-111111111111',
    'EVIDENCE_AUDIT', 'DONE', 'seed', 'seed-v1',
    $json${
      "product": {"matchesListing": true, "expectedWeightKg": 0.3, "reason": "The black headphones in photo A match the model and condition in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the same headphones inside the box with the case and cable."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows the closed parcel and the whole shipping guide."},
      "guide": {"readable": true, "carrier": "UPS", "trackingNumber": "1Z999AA10123456784", "weightKg": 1.4, "date": "2026-10-28"},
      "inconsistencies": []
    }$json$::jsonb,
    '[]'::jsonb, '{}'::text[],
    now() - interval '2 hours 50 minutes', now() - interval '2 hours 40 minutes',
    now() - interval '2 hours 50 minutes', now() - interval '2 hours 40 minutes'
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    'b2222222-2222-4222-8222-222222222222',
    'EVIDENCE_AUDIT', 'DONE', 'seed', 'seed-v1',
    $json${
      "product": {"matchesListing": true, "expectedWeightKg": 1.4, "reason": "Photo A shows a white Switch OLED with the same joy-cons in the listing."},
      "packing": {"productInside": true, "reason": "Photo B shows the console, dock and cables inside the box."},
      "parcel": {"sealed": true, "guideVisible": true, "reason": "Photo C shows a sealed parcel and a full guide."},
      "guide": {"readable": true, "carrier": "USPS", "trackingNumber": "9400111899223856928498", "weightKg": 0.4, "date": "2026-10-28"},
      "inconsistencies": ["The guide records 0.4 kg. A Switch OLED with packing usually weighs 1.2 to 1.6 kg."]
    }$json$::jsonb,
    '[]'::jsonb, array['WEIGHT_OUT_OF_RANGE']::text[],
    now() - interval '2 hours 50 minutes', now() - interval '2 hours 40 minutes',
    now() - interval '2 hours 50 minutes', now() - interval '2 hours 40 minutes'
  )
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from public.events
    where deal_id = 'b1111111-1111-4111-8111-111111111111'
  ) then
    insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
      ('b1111111-1111-4111-8111-111111111111', 'paypal', null, 'FUNDS_HELD', '{"title":"Payment captured","detail":"37.50 USD is held in the platform account."}'::jsonb, now() - interval '3 hours'),
      ('b1111111-1111-4111-8111-111111111111', 'system', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence audit started","detail":"The model checked photos A, B and C."}'::jsonb, now() - interval '2 hours 50 minutes'),
      ('b1111111-1111-4111-8111-111111111111', 'ai', 'AUDITING', 'SHIPPED', '{"title":"Audit completed","detail":"Four checks passed and the guide is readable."}'::jsonb, now() - interval '2 hours 40 minutes');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from public.events
    where deal_id = 'b2222222-2222-4222-8222-222222222222'
  ) then
    insert into public.events (deal_id, actor, from_state, to_state, payload, created_at) values
      ('b2222222-2222-4222-8222-222222222222', 'paypal', null, 'FUNDS_HELD', '{"title":"Payment captured","detail":"95.00 USD is held in the platform account."}'::jsonb, now() - interval '3 hours'),
      ('b2222222-2222-4222-8222-222222222222', 'system', 'FUNDS_HELD', 'AUDITING', '{"title":"Evidence audit started","detail":"The model checked photos A, B and C."}'::jsonb, now() - interval '2 hours 50 minutes'),
      ('b2222222-2222-4222-8222-222222222222', 'ai', 'AUDITING', 'EVIDENCE_REJECTED', '{"title":"Evidence rejected","detail":"The guide records 0.4 kg. That is too light for the switch, so shipping is blocked."}'::jsonb, now() - interval '2 hours 40 minutes');
  end if;
end;
$$;
