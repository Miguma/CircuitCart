"use client";
import { useEffect, useState } from "react";
import { loadPayoutAccount, savePayoutAccount, type SavedAccount } from "@/lib/finance/client";
import { financePanel, financeButton, financeInput } from "./finance-dashboard";

export function PayoutAccount() {
  const [account,setAccount]=useState<SavedAccount|null>(null);
  const [editing,setEditing]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [bankName,setBankName]=useState("");
  const [accountName,setAccountName]=useState("");
  const [accountNumber,setAccountNumber]=useState("");
  useEffect(()=>{ let active=true; loadPayoutAccount().then(value=>{
    if(active){setAccount(value);setBankName(value?.bank_name||"");setAccountName(value?.account_name||"");setEditing(!value);}
  }).catch(()=>{if(active)setError("Unable to load your payout account. Verify seller access and the finance migration, then reload.");})
    .finally(()=>{if(active)setLoading(false);}); return()=>{active=false;};},[]);
  async function save(event:React.FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{await savePayoutAccount({bankName,accountName,accountNumber});setAccountNumber("");setAccount(await loadPayoutAccount());setEditing(false);}
    catch(err){setError(err instanceof Error?err.message:"Unable to save account.");}
    finally{setBusy(false);}
  }
  return <section className={`${financePanel} space-y-4`} aria-label="Payout account">
    <div><h2 className="text-lg font-bold">Payout account</h2><p className="mt-1 text-sm text-[#d6cbd5]">Choose where CircuitCart should release your marketplace earnings.</p></div>
    <p className="text-xs text-[#b9adb6]">Demo Card payouts are simulated for the academic sandbox. No real bank transfer occurs. Saving an account does not verify it with your bank.</p>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
    {loading?<p role="status">Loading account…</p>:editing?<form onSubmit={save} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm">Bank name<input className={financeInput} value={bankName} minLength={2} maxLength={100} required onChange={e=>setBankName(e.target.value)}/></label>
        <label className="text-sm">Account holder name<input className={financeInput} value={accountName} minLength={2} maxLength={150} required onChange={e=>setAccountName(e.target.value)}/></label>
        <label className="text-sm">Account number<input className={financeInput} type="password" inputMode="numeric" autoComplete="off" value={accountNumber} pattern="[0-9]{6,34}" minLength={6} maxLength={34} required onChange={e=>setAccountNumber(e.target.value)}/></label>
      </div><p className="text-xs text-[#b9adb6]">Enter only the destination account number. Never enter a password, PIN, OTP or card details. Re-enter the number when editing; saved numbers stay masked.</p>
      <div className="flex gap-3"><button className={financeButton} disabled={busy}>Save payout account</button>{account&&<button type="button" className={financeButton} disabled={busy} onClick={()=>{setEditing(false);setAccountNumber("");setBankName(account.bank_name);setAccountName(account.account_name);}}>Cancel</button>}</div>
    </form>:account&&<div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/5 p-4"><div><p className="text-xs text-[#b9adb6]">Saved payout account</p><p className="mt-2 font-bold">{account.bank_name}</p><p>{account.account_name}</p><p>••••••••{account.account_last4}</p></div><button className={financeButton} onClick={()=>setEditing(true)}>Edit</button></div>}
  </section>;
}
