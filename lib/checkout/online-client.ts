import { onlineCheckoutResult, type OnlineCheckoutInput } from "./online-contract";

export async function readOnlineCheckout(attemptId?: string) {
  // Recovery may expire this buyer's due reservation, so use POST, never a mutating GET.
  const response = await fetch("/api/checkout/online", {
    method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "recover", ...(attemptId ? { attemptId } : {}) }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to recover payment status.");
  return onlineCheckoutResult.nullable().parse(body.checkout);
}

export async function cancelOnlineCheckout(attemptId: string) {
  const response = await fetch("/api/checkout/online", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "cancel", attemptId }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to cancel checkout. Recover its status before retrying.");
  return onlineCheckoutResult.parse(body.checkout);
}

export async function createOnlineCheckout(input: OnlineCheckoutInput) {
  const response = await fetch("/api/checkout/online", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Checkout failed. Retry the same attempt.");
  return onlineCheckoutResult.parse(body.checkout);
}
