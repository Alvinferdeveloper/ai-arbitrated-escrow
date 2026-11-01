import { isSupabaseConfigured } from "@/lib/db/server";
import { dealIdSchema } from "@/lib/deals/schema";
import { confirmCheckout } from "@/lib/paypal/checkout";
import { isPayPalConfigured } from "@/lib/paypal/config";

// PayPal sends the buyer back here after approval with `token` (the order id)
// and `PayerID`. We capture the order, then send the buyer to the Trust Link.
// A successful capture still shows as pending until the webhook confirms it.

export const maxDuration = 30;

function backTo(request: Request, dealId: string, payment: string): Response {
  const url = new URL(`/t/${dealId}`, request.url);
  url.searchParams.set("payment", payment);
  return Response.redirect(url, 303);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId } = await context.params;
  const parsedDeal = dealIdSchema.safeParse(dealId);

  if (!parsedDeal.success) {
    return new Response("Invalid deal id.", { status: 400 });
  }

  const orderId = new URL(request.url).searchParams.get("token");

  if (!orderId) {
    return backTo(request, parsedDeal.data, "error");
  }

  if (!isSupabaseConfigured() || !isPayPalConfigured()) {
    return backTo(request, parsedDeal.data, "not-configured");
  }

  try {
    const outcome = await confirmCheckout({
      dealId: parsedDeal.data,
      orderId,
    });

    return backTo(request, parsedDeal.data, outcome);
  } catch (error) {
    console.error("PayPal capture failed", error);
    return backTo(request, parsedDeal.data, "error");
  }
}
