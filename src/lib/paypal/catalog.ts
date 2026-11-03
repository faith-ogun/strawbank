// F1 step 3: the day's items in the grower's PayPal catalogue (Catalog Products
// API, through the Agent Toolkit's create_product). An item gets a product the
// first time it is sold and keeps it afterwards: the id is kept in Firestore at
// stands/{standId}/products/{key}, and each create carries a PayPal-Request-Id
// made from the stand and item, so a repeated create returns the same product.
// Code calls the tool; the model never does.

import { runAgentTool } from "../../agent/tools";
import { paypalToolkitTools } from "../../agent/toolkit";
import { firestore } from "../firestore";
import type { CatalogueItem } from "../orders";
import { noted } from "./calls";

type Executable = { execute?: (args: never, options?: never) => unknown };

const products = (standId: string) => firestore().collection("stands").doc(standId).collection("products");

function productIdFrom(raw: unknown): string {
  const reply = (typeof raw === "string" ? JSON.parse(raw) : raw) as { id?: unknown; message?: unknown };
  if (typeof reply?.id !== "string") throw new Error(`PayPal made no product (${String(reply?.message ?? "no reply")})`);
  return reply.id;
}

/** The catalogue with each item's PayPal product id, creating the products that do not exist yet. */
export async function withProducts(standId: string, standName: string, catalogue: CatalogueItem[]): Promise<CatalogueItem[]> {
  const snaps = await firestore().getAll(...catalogue.map((i) => products(standId).doc(i.key)));
  return Promise.all(
    catalogue.map(async (item, i) => {
      const known = snaps[i].data() as { productId?: string } | undefined;
      if (known?.productId) return { ...item, productId: known.productId };
      const tools = paypalToolkitTools({ requestId: `catalog-${standId}-${item.key}` });
      const productId = await noted(
        { standId, who: "grower", what: `list "${item.name}" in the PayPal catalogue (Agent Toolkit create_product)`, endpoint: "POST /v1/catalogs/products" },
        async () =>
          productIdFrom(
            await runAgentTool(tools as Record<string, Executable>, "create_product", {
              name: item.name.replace(/, each$/i, ""),
              type: "PHYSICAL",
              description: `${item.name}, sold at ${standName}, an unstaffed farm stand`,
            }),
          ),
        (id) => ({ status: 201, ref: id }),
      );
      await products(standId).doc(item.key).set({ productId, name: item.name, createdAt: new Date().toISOString() });
      return { ...item, productId };
    }),
  );
}
