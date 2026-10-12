"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Loader2, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { DbChatOffer } from "@/lib/supabase/types";
import { getConversationOffers, respondChatOffer, sendChatOffer, subscribeToOffers } from "@/lib/supabase/messages";

interface Props { conversationId: string; productId: string; listingPrice: number; stock: number; isSeller: boolean; }
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);

export function PrivateOfferPanel({ conversationId, productId, listingPrice, stock, isSeller }: Props) {
  const [offers, setOffers] = useState<DbChatOffer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [price, setPrice] = useState(String(listingPrice));
  const [quantity, setQuantity] = useState("1");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setOffers(await getConversationOffers(conversationId)); }
    catch (error) { console.warn("Failed to load offers", error); }
  }, [conversationId]);

  useEffect(() => {
    getConversationOffers(conversationId).then(setOffers).catch((error) => console.warn("Failed to load offers", error));
    return subscribeToOffers(conversationId, () => void load());
  }, [conversationId, load]);
  const current = useMemo(() => [...offers].reverse().find((offer) =>
    offer.product_id === productId && ["pending", "accepted", "reserved", "consumed"].includes(offer.status)
  ), [offers, productId]);

  const submit = async () => {
    const unitPrice = Number(price); const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > stock || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error("Enter a valid price and available quantity."); return;
    }
    setBusy(true);
    try { await sendChatOffer(conversationId, productId, count, unitPrice, 24); await load(); setShowForm(false); toast.success("Private offer sent."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Offer failed."); }
    finally { setBusy(false); }
  };

  const respond = async (action: "accept" | "decline" | "withdraw") => {
    if (!current) return; setBusy(true);
    try { await respondChatOffer(current.id, action); await load(); toast.success(action === "accept" ? "Offer accepted and added to your cart." : "Offer updated."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Offer update failed."); }
    finally { setBusy(false); }
  };

  return <div className="border-t cc-border cc-surface-card px-4 py-2.5">
    {current ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e59bc9]/25 bg-[#e59bc9]/5 px-3 py-2">
      <Tag className="size-4 text-[#e59bc9]" />
      <div className="min-w-0 flex-1 text-xs"><p className="font-bold cc-text-primary">Private offer: {current.quantity} × {money(Number(current.unit_price))}</p><p className="cc-text-muted">{money(Number(current.unit_price) * current.quantity)} total · {current.status} · expires {new Date(current.expires_at).toLocaleString()}</p></div>
      {current.status === "pending" && !isSeller && <><button disabled={busy} onClick={() => void respond("accept")} className="rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white"><Check className="mr-1 inline size-3" />Accept</button><button disabled={busy} onClick={() => void respond("decline")} className="rounded-lg border cc-border px-2.5 py-1.5 text-[11px] font-bold cc-text-muted"><X className="mr-1 inline size-3" />Decline</button></>}
      {isSeller && ["pending", "accepted"].includes(current.status) && <button disabled={busy} onClick={() => void respond("withdraw")} className="rounded-lg border cc-border px-2.5 py-1.5 text-[11px] font-bold cc-text-muted">Withdraw</button>}
    </div> : isSeller && !showForm ? <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-[#54385c] px-3 py-2 text-xs font-bold text-white"><Tag className="size-3.5" />Send private offer</button> : null}
    {isSeller && showForm && <div className="flex flex-wrap items-end gap-2 rounded-xl border cc-border p-2.5">
      <label className="text-[10px] font-bold cc-text-muted">PRICE EACH<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" className="mt-1 block w-28 rounded-lg border cc-border cc-surface-secondary px-2 py-1.5 text-xs cc-text-primary" /></label>
      <label className="text-[10px] font-bold cc-text-muted">QTY<input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" className="mt-1 block w-16 rounded-lg border cc-border cc-surface-secondary px-2 py-1.5 text-xs cc-text-primary" /></label>
      <button disabled={busy} onClick={() => void submit()} className="rounded-lg bg-[#54385c] px-3 py-2 text-xs font-bold text-white">{busy ? <Loader2 className="size-3.5 animate-spin" /> : "Send"}</button><button disabled={busy} onClick={() => setShowForm(false)} className="rounded-lg border cc-border px-3 py-2 text-xs cc-text-muted">Cancel</button>
      <p className="w-full text-[10px] cc-text-faint"><Clock3 className="mr-1 inline size-3" />Valid for 24 hours. This changes only this buyer&apos;s checkout price.</p>
    </div>}
  </div>;
}
