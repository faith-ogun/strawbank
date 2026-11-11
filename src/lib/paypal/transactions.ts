// F5 against PayPal: Transaction Search (GET /v1/reporting/transactions)
// through the PayPal Server SDK's TransactionSearchController. Read only, so the
// SDK may retry it (src/lib/paypal/client.ts). Written with the APIMatic Context
// Plugin's TypeScript skills (calling endpoints, models, error handling): the
// operation takes one options object, and an error's payload keeps PayPal's own
// field names.

import { ApiError, TransactionSearchController } from "@paypal/paypal-server-sdk";
import type { PayPalTransaction } from "../audit";
import { paypalClient } from "./client";
import { PayPalError } from "./orders";

const PAGE_SIZE = 500;
const MAX_PAGES = 10;

/** PayPal wants seconds and an offset, for example 2026-11-03T00:00:00Z without milliseconds. */
const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** Every transaction PayPal reports between two times (at most 31 days apart). */
export async function searchTransactions(from: Date, to: Date): Promise<PayPalTransaction[] & { debugId?: string }> {
  const api = new TransactionSearchController(paypalClient());
  const out: PayPalTransaction[] & { debugId?: string } = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let result;
    try {
      let headers: Record<string, string>;
      ({ result, headers } = await api.searchTransactions({
        startDate: isoSeconds(from),
        endDate: isoSeconds(to),
        fields: "transaction_info",
        pageSize: PAGE_SIZE,
        page,
      }));
      out.debugId ??= headers["paypal-debug-id"];
    } catch (error) {
      if (error instanceof ApiError) {
        const body = (error.result ?? {}) as { message?: string; debug_id?: string; name?: string };
        throw new PayPalError(body.message ?? `PayPal's Transaction Search returned ${error.statusCode}`, error.statusCode, body.debug_id, body.name);
      }
      throw error;
    }
    for (const detail of result.transactionDetails ?? []) {
      const info = detail.transactionInfo;
      if (!info?.transactionId || !info.transactionAmount) continue;
      out.push({
        transactionId: info.transactionId,
        referenceId: info.paypalReferenceId,
        amount: info.transactionAmount.value,
        currency: info.transactionAmount.currencyCode,
        status: info.transactionStatus,
        customField: info.customField,
        eventCode: info.transactionEventCode,
      });
    }
    if (!result.totalPages || page >= result.totalPages) break;
  }
  return out;
}
