import { fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { cancelOrder } from "@/lib/checkout";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please log in.", 401);
  const { id } = await params;
  // Our policy is "no cancellations": only an order that was never paid (an abandoned checkout) can still be cancelled by the customer.
  const order = await prisma.order.findFirst({ where: { id, userId: user.id }, select: { paymentStatus: true } });
  if (!order) return fail("Order not found.", 404);
  if (order.paymentStatus !== "UNPAID" && order.paymentStatus !== "FAILED") {
    return fail("Orders can't be cancelled once they are placed. Please see our return & exchange policy.", 403);
  }
  const result = await cancelOrder(id, { by: "customer", userId: user.id, reason: "Cancelled by customer" });
  if (!result.ok) return fail(result.error, 400);
  return ok();
}
