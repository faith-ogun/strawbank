import fc from "fast-check";
import { openSession, sealSession, SESSION_MAX_AGE_S } from "../../src/lib/session";
import { assert, moneyProperty } from "./shared";

// The grower's pages hold sales and refund approvals, so the session cookie
// guards money too: only one the server sealed, unaltered and in date, opens
// them.

const sessionCase = fc.record({
  key: fc.string({ minLength: 32, maxLength: 64 }),
  otherKey: fc.string({ minLength: 32, maxLength: 64 }),
  grower: fc.record({
    growerId: fc.oneof(fc.constant("demo"), fc.string({ minLength: 1, maxLength: 40 })),
    name: fc.string({ maxLength: 60 }),
    standId: fc.option(fc.constant("demo"), { nil: undefined }),
  }),
  now: fc.integer({ min: 1_700_000_000_000, max: 1_900_000_000_000 }),
  /** Where to alter one character of the cookie. */
  at: fc.nat(10_000),
  junk: fc.string({ maxLength: 200 }),
});

const onlySealedSessionsOpen = fc.property(sessionCase, ({ key, otherKey, grower, now, at, junk }) => {
  const token = sealSession(grower, key, now);

  const opened = openSession(token, key, now + 1000);
  assert(
    opened?.growerId === grower.growerId && opened.name === grower.name && opened.standId === grower.standId,
    "a fresh session did not open as sealed",
  );

  const i = at % token.length;
  const altered = token.slice(0, i) + (token[i] === "A" ? "B" : "A") + token.slice(i + 1);
  assert(openSession(altered, key, now) === undefined, "an altered session opened");
  assert(otherKey === key || openSession(token, otherKey, now) === undefined, "a session sealed with another key opened");
  assert(openSession(token, key, now + SESSION_MAX_AGE_S * 1000 + 1) === undefined, "an expired session opened");
  assert(junk === token || openSession(junk, key, now) === undefined, "a made-up cookie opened");
  assert(openSession(undefined, key, now) === undefined, "no cookie opened");
});

export const p7 = [
  moneyProperty(
    "E4.7",
    "A grower session opens only if the server sealed it, unaltered and in date",
    onlySealedSessionsOpen,
  ),
];
