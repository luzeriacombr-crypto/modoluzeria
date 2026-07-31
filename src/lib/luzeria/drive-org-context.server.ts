// Server-only. Never import this at the top level of a *.functions.ts or
// route file — those ship to the client bundle, and `node:async_hooks`
// doesn't exist in the browser. Always `await import(...)` it from inside a
// server handler, same pattern as `client.server.ts`.
import { AsyncLocalStorage } from "node:async_hooks";

const driveOrgAls = new AsyncLocalStorage<string>();

/** Carries the calling org's id through every Drive helper call for the
 * duration of one request, without threading it through every function
 * signature. */
export function withDriveOrg<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return driveOrgAls.run(orgId, fn);
}

export function currentDriveOrgId(): string | undefined {
  return driveOrgAls.getStore();
}
