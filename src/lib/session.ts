// The grower's session: a cookie the server seals with an HMAC, holding who
// signed in and which stand they run. Customers never have one. Eval E4.7
// checks that only a sealed, unaltered, in-date cookie opens.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

export const SESSION_COOKIE = "sb_grower";
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export type Grower = {
  /** "demo" for the demo grower; otherwise the PayPal account id from Log in with PayPal. */
  growerId: string;
  name: string;
  /** The stand they run; none until they set one up. */
  standId?: string;
};

type Sealed = Grower & { exp: number };

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

export function sealSession(grower: Grower, key: string, now = Date.now()): string {
  const sealed: Sealed = { ...grower, exp: now + SESSION_MAX_AGE_S * 1000 };
  const payload = Buffer.from(JSON.stringify(sealed)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function openSession(token: string | undefined, key: string, now = Date.now()): Grower | undefined {
  if (!token) return undefined;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return undefined;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as Partial<Sealed>;
    if (typeof value.growerId !== "string" || typeof value.name !== "string" || typeof value.exp !== "number") return undefined;
    if (value.standId !== undefined && typeof value.standId !== "string") return undefined;
    if (now > value.exp) return undefined;
    return { growerId: value.growerId, name: value.name, standId: value.standId };
  } catch {
    return undefined;
  }
}

function sessionKey(): string {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return key;
}

/** The signed-in grower, if any. Reads the request's cookies. */
export async function currentGrower(): Promise<Grower | undefined> {
  await connection(); // the expiry check reads the clock, so never at build time
  return openSession((await cookies()).get(SESSION_COOKIE)?.value, sessionKey());
}

/** Signs a grower in. Route Handlers and Server Functions only. */
export async function startSession(grower: Grower): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, sealSession(grower, sessionKey()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
