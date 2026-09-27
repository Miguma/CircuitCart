"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IdOcrPanel } from "./id-ocr-panel";

/** Uses the authenticated Storage download API: existing owner/admin RLS still applies. */
export function AdminIdOcr({ path }: { path: string }) {
  const [file, setFile] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    createClient().storage.from("seller-verification").download(path)
      .then(({ data, error }) => { if (mounted) { setFile(error ? null : data); setError(!!error || !data); } })
      .catch(() => { if (mounted) setError(true); });
    return () => { mounted = false; };
  }, [path, attempt]);
  if (!file) return <div className="rounded-xl border cc-border cc-surface-card p-4 cc-text-primary text-sm">
    {error ? <>Could not load the ID for local OCR. You can still use the document preview and manual review. <button className="underline" type="button" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Retry image</button></> : "Loading original ID for manual review..."}
  </div>;
  return <IdOcrPanel file={file} />;
}
