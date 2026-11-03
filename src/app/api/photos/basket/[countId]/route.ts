import { growerStand } from "@/lib/grower-guard";
import { readPhoto } from "@/lib/photos";
import { readBasket } from "@/lib/sales";

// A basket photo, for the grower of the stand it was taken at, and nobody else.
export async function GET(_request: Request, ctx: RouteContext<"/api/photos/basket/[countId]">) {
  const guard = await growerStand();
  if ("refused" in guard) return guard.refused;
  const { countId } = await ctx.params;
  const basket = /^[0-9a-f-]{36}$/.test(countId) ? await readBasket(countId) : undefined;
  if (!basket || basket.standId !== guard.stand.id) return new Response("not found", { status: 404 });
  const { data, contentType } = await readPhoto(basket.photo);
  return new Response(Buffer.from(data), { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
}
