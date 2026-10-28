// The PayPal Server SDK client, built once per server process and reused, so
// its OAuth token is cached between calls. Written with the APIMatic Context
// Plugin's TypeScript skills (client initialisation, authentication,
// configuration and resilience).
//
// Sandbox only (hard rule): the environment is fixed here and there is no
// setting that changes it.

import { Client, Environment } from "@paypal/paypal-server-sdk";
import { paypalCredentials } from "./config";

/** Per attempt, in ms. The SDK's own default is 0, which means wait forever. */
const TIMEOUT_MS = 20_000;

let client: Client | undefined;

export function paypalClient(): Client {
  if (!client) {
    const { clientId, clientSecret } = paypalCredentials();
    client = new Client({
      environment: Environment.Sandbox,
      clientCredentialsAuthCredentials: {
        oAuthClientId: clientId,
        oAuthClientSecret: clientSecret,
        // Refresh a minute early rather than send a request with a token about to expire.
        oAuthClockSkew: 60,
      },
      timeout: TIMEOUT_MS,
      httpClientOptions: {
        timeout: TIMEOUT_MS,
        // Reads only. A POST that creates, captures or refunds is never re-sent by the SDK;
        // its PayPal-Request-Id makes a deliberate retry by our code safe instead.
        retryConfig: { maxNumberOfRetries: 2, maximumRetryWaitTime: 10, httpMethodsToRetry: ["GET"] },
      },
    });
  }
  return client;
}
