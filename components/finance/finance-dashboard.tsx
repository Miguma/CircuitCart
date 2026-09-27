"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Landmark, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { financeUnavailable, loadFinanceSummary, loadPayouts, money, requestSellerPayout, type FinanceSummary, type PayoutRow } from "@/lib/finance/client";
import { payoutActions, percentToBps } from "@/lib/finance/contracts";

export const financePanel = "rounded-2xl border border-white/10 bg-[#211826] p-5 sm:p-6 text-[#fffafa]";
export const financeButton = "rounded-xl border border-white/15 bg-[#65486f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a5985] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#e59bc9]";
export const financeInput = "mt-2 w-full rounded-xl border border-white/20 bg-[#302435] p-3 text-white focus:outline-2 focus:outline-[#e59bc9]";

type FetchState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; summary: FinanceSummary; rows: PayoutRow[] };

function fetchReducer(_: FetchState, action: FetchState): FetchState { return action; }

export function FinanceDashboard({ admin = false, history = true }: { admin?: boolean; history?: boolean }) {
  const [state, dispatch] = useReducer(fetchReducer, { phase: "loading" });
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [rate, setRate] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const load = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ phase: "loading" });
    Promise.all([loadFinanceSummary(), history ? loadPayouts(offset) : Promise.resolve([])])
      .then(([summary, rows]) => {
        if (!cancelled) {
          setRate((summary.commissionRateBps / 100).toFixed(2));
          dispatch({ phase: "ready", summary, rows });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ phase: "error", message: financeUnavailable });
      });
    return () => { cancelled = true; };
  }, [history, offset, refreshTick]);

  const loading = state.phase === "loading";
  const summary = state.phase === "ready" ? state.summary : null;
  const rows = state.phase === "ready" ? state.rows : [];
  const error = state.phase === "error" ? state.message : "";

  async function changeStatus(row: PayoutRow, status: string) {
    if (status === "released" && !window.confirm("Record a simulated payout release? No bank transfer occurs. This status cannot be undone.")) return;
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("admin_update_payout_status", { p_payout_id: row.id, p_status: status });
      if (error || data !== true) throw new Error();
      load(); setNotice("Payout status updated. No real money was transferred.");
    } catch { setNotice("Payout not updated. Check the current status, completed order, and saved payout account, then refresh."); }
    finally { setBusy(false); }
  }

  async function requestPayout(row: PayoutRow) {
    if (!window.confirm(`Request simulated payout of ${money(row.net_amount)} to your saved payout account?`)) return;
    setBusy(true); setNotice("");
    try {
      await requestSellerPayout(row.id);
      load();
      setNotice("Payout requested. CircuitCart marked it as processing for admin release. No real money was transferred.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payout request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRate(event: React.FormEvent) {
    event.preventDefault();
    const bps = percentToBps(rate);
    if (bps === null) { setNotice("Enter 0–30% with at most two decimal places."); return; }
    setBusy(true); setNotice("");
    try {
      const { data, error } = await createClient().rpc("admin_set_commission_rate", { p_rate_bps: bps });
      if (error || data !== bps) throw new Error();
      load(); setNotice("Commission updated for future financial records only.");
    } catch { setNotice("Commission was not updated. Verify administrator access and try again."); }

    finally { setBusy(false); }
  }
  const metrics: [string, number, string][] = summary ? [
    [admin ? "Gross marketplace volume" : "Gross marketplace sales", summary.totals.gross, "Ledger-backed sales before fees, including shipping."],
    [admin ? "Platform commission revenue" : "Platform fees", summary.totals.fees, "Recorded commission: collected + receivable, not gross sales."],
    [admin ? "Total seller net earnings" : "Net earnings", summary.totals.net, "Gross less recorded fees; not a bank balance."],
    ["Pending payout", summary.payouts.pending, "Paid online orders awaiting completion."],
    ["Available / eligible", summary.payouts.eligible, "Completed orders eligible for simulated payout."],
    ["Released (simulated)", summary.payouts.released, "Bookkeeping only. Not deposited into a bank."],
    [admin ? "Commission receivable" : "Offline commission due", summary.totals.receivable, "Seller-direct cash fees owed, not collected."],
    ...(admin ? [["Collected commission (sandbox included)", summary.totals.collected, "Ledger-marked collected; sandbox amounts are not funds."]] as [string,number,string][] : []),
  ] : [];
  return <section className="space-y-5" aria-label={admin ? "Platform finance" : "Seller finance"}>
    <div className={`${financePanel} flex flex-wrap items-start justify-between gap-4`}>
      <div className="max-w-3xl space-y-2"><h2 className="flex items-center gap-2 text-lg font-bold"><Landmark className="size-5 text-[#e59bc9]" />{admin ? "Platform finance" : "Marketplace earnings"}</h2>
        <p className="text-sm text-[#d6cbd5]">Demo Card earnings are sandbox values for academic demonstration. Sandbox transactions do not represent real funds. No real bank transfer occurs.</p>
        <p className="text-xs text-[#b9adb6]">All-time recorded financial activity. Historical payout amounts are preserved; older seller-direct sales without a ledger entry are not back-charged.</p></div>
      <button className={financeButton} disabled={loading || busy} onClick={() => void load()}><RefreshCw className="mr-2 inline size-4" />Refresh</button>
    </div>
    {notice && <p role="status" className="rounded-xl border border-[#e59bc9]/30 bg-[#302435] p-4 text-sm text-white">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</p>}
    {loading ? <p role="status" className="p-5 text-sm text-[#d6cbd5]">Loading financial records…</p> : summary && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value,description]) => <div key={label} className={financePanel}>
        <h3 className="text-xs font-semibold text-[#d6cbd5]">{label}</h3><p className="my-2 break-words text-2xl font-bold tabular-nums">{money(value)}</p><p className="text-xs leading-relaxed text-[#b9adb6]">{description}</p>
      </div>)}</div>
      <div className={`${financePanel} space-y-2 text-sm`}>
        <p>Sandbox portion: {money(summary.totals.sandbox_gross)} gross · {money(summary.totals.sandbox_fees)} fees.</p>
        <p>{summary.totals.sales} recorded sales · {summary.totals.transactions} paid online transactions · Processing: {money(summary.payouts.processing)} · Held: {money(summary.payouts.held)}</p>
      </div>
      {!history && <div className={financePanel}><h3 className="mb-4 font-bold">Net earnings by month</h3>
        {summary.months.length === 0 ? <p className="text-sm text-[#b9adb6]">No recorded earnings yet.</p> : <div className="space-y-4">{summary.months.map((month) => <div key={month.month}>
          <div className="mb-2 flex justify-between gap-3 text-sm"><span>{month.month} · {month.sales} sales</span><span>{money(month.net)}</span></div>
          <div className="h-2 rounded bg-white/10"><div className="h-2 rounded bg-[#e59bc9]" style={{ width: `${Math.max(0,Number(month.net))/Math.max(1,...summary.months.map(m=>Number(m.net)))*100}%` }} /></div>
        </div>)}</div>}<p className="mt-4 text-xs text-[#b9adb6]">Latest 12 active months, Philippine time. Includes clearly identified sandbox sales above.</p></div>}
      {admin && <form onSubmit={saveRate} className={`${financePanel} space-y-4`}>
        <h3 className="font-bold">Marketplace commission</h3>
        <label className="block max-w-xs text-sm">Commission (%)<input className={financeInput} inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value)} required /></label>
        <p className="text-sm text-[#d6cbd5]">Changes apply to future financial records only. Existing financial records retain their original commission rate. Allowed range: 0–30%.</p>
        <button className={financeButton} disabled={busy}>Save commission rate</button>
      </form>}
      {history && <div className={`${financePanel} min-w-0`}>
        <h3 className="mb-4 font-bold">{admin ? "Payout management" : "Payout history"}</h3>
        {rows.length===0 ? <p className="text-sm text-[#b9adb6]">No payouts on this page. COD and meetup cash do not create platform payouts.</p> : <div className="overflow-x-auto">
          <table className="w-full text-left text-xs"><thead className="border-b border-white/15 text-[#b9adb6]"><tr>{["Order / seller","Gross / fee / net","Destination","Status","Dates",...(!admin?["Action"]:["Actions"])].map(h=><th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map(row=><tr key={row.id} className="border-b border-white/10 align-top">
              <td className="p-3"><p className="font-semibold">CC-{row.order_id.slice(0,8).toUpperCase()}</p><p className="mt-1">{row.shop_name}</p>{admin&&<p>{row.seller_name || "Seller"}</p>}<p className="mt-1 text-[#b9adb6]">{row.payment_method === "demo_card" ? "Demo Card · sandbox" : "Maya · sandbox"}</p></td>
              <td className="whitespace-nowrap p-3 tabular-nums"><p>Gross {money(row.gross_amount)}</p><p>Fee {money(row.platform_fee)}</p><p className="font-semibold text-[#e59bc9]">Net {money(row.net_amount)}</p><p className="mt-1 text-[#b9adb6]">{row.commission_rate_bps===null ? "Historical rate not recorded" : `${(row.commission_rate_bps/100).toFixed(2)}% subtotal fee`}</p></td>
              <td className="p-3">{row.account_last4 ? <><p>{row.bank_name}</p><p>{row.account_name}</p><p>••••••••{row.account_last4}</p></> : "No saved account"}</td>
              <td className="p-3"><span className="rounded-full bg-white/10 px-2 py-1 capitalize">{row.status}</span>{row.status==="released"&&<p className="mt-2 text-[#b9adb6]">Simulated payout</p>}</td>
              <td className="whitespace-nowrap p-3 text-[#b9adb6]">{([["Created",row.created_at],["Eligible",row.eligible_at],["Released",row.released_at]]).map(([label,date])=><p key={label}>{label}: {date ? new Date(date).toLocaleDateString("en-PH") : "—"}</p>)}</td>
              {admin ? <td className="p-3"><div className="flex min-w-40 flex-col gap-2">{(payoutActions[row.status]||[]).map(action=><button key={action.status} className={financeButton} disabled={busy || (action.status!=="held" && row.order_status!=="completed")} onClick={()=>void changeStatus(row,action.status)}>{action.label}</button>)}</div></td>
                : <td className="p-3">{row.status === "eligible" ? <button className={financeButton} disabled={busy || !row.account_last4 || row.order_status !== "completed"} onClick={()=>void requestPayout(row)}>Request payout</button> : <span className="text-[#b9adb6]">{row.status === "pending" ? "Available after order completion" : row.status === "processing" ? "Awaiting admin release" : row.status === "released" ? "Released" : "—"}</span>}</td>}
            </tr>)}</tbody></table>
        </div>}
        <div className="mt-4 flex items-center justify-between gap-3"><button className={financeButton} disabled={offset===0 || busy} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span className="text-xs text-[#b9adb6]">Page {offset/50+1} · 50 per page</span><button className={financeButton} disabled={rows.length<50 || busy} onClick={()=>setOffset(offset+50)}>Next</button></div>
      </div>}
    </>}
  </section>;
}
