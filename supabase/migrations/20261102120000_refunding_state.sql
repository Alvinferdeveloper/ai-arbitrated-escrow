-- The AI can cancel a deal before shipping. REFUNDING holds the deal while
-- PayPal returns the money; its webhook moves it to REFUNDED. Kept alone
-- because a new enum value cannot be used in the transaction that adds it.

alter type public.deal_state add value if not exists 'REFUNDING' after 'ESCALATED';
