"use client";

import { useEffect, useRef, useState } from "react";
import { readIdText, type OcrResult, type OcrProgress } from "@/lib/verification/ocr";
import type { OcrCandidates } from "@/lib/verification/ocr-parser";

const fallback = "We couldn't clearly read this ID automatically. Please review your information manually before submitting.";
const button = "rounded-lg border cc-border cc-surface-secondary cc-text-primary px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function IdOcrPanel({ file, onUse, autoScan = false }: {
  file: Blob;
  autoScan?: boolean;
  onUse?: (field: keyof OcrCandidates, value: string) => void;
}) {
  const preview = useRef<HTMLImageElement>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(autoScan ? { label: "Preparing OCR...", percent: 0 } : null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(autoScan ? 1 : 0);
  const [stopped, setStopped] = useState(false);
  const active = useRef<ReturnType<typeof readIdText> | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!attempt) return;
    let mounted = true;
    const job = readIdText(file, (value) => { if (mounted) setProgress(value); });
    active.current = job;
    job.result.then((value) => { if (mounted) setResult(value); })
      .catch(() => { if (mounted) setError(fallback); })
      .finally(() => { if (mounted) { setProgress(null); active.current = null; } });
    return () => { mounted = false; job.cancel(); };
  }, [file, attempt]);

  return (
    <section aria-label="OCR assistance" className="min-w-0 rounded-2xl border cc-border cc-surface-card cc-text-primary p-4 sm:p-5">
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 font-semibold">Original ID</h3>
          {/* Private blob URL managed by the effect; never use an image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={preview} alt="Selected original ID evidence" className="h-64 w-full rounded-xl object-contain cc-surface-secondary" />
          <p className="mt-2 text-xs cc-text-muted">The original upload is unchanged. OCR runs locally; engine and English language resources require internet access.</p>
        </div>
        <div className="min-w-0 space-y-3">
          <h3 className="font-semibold">OCR Assistance</h3>
          <p className="text-sm cc-text-secondary">Manual review required. OCR reads text only; it cannot establish identity, document authenticity, or a selfie match.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} disabled={!!progress} onClick={() => {
              setResult(null); setError(""); setStopped(false);
              setProgress({ label: "Preparing OCR...", percent: 0 });
              setAttempt((n) => n + 1);
            }}>{result || error ? "Scan ID Text Again" : "Scan ID Text"}</button>
            {progress && <button type="button" className={button} onClick={() => { setStopped(true); active.current?.cancel(); }}>Cancel scan</button>}
          </div>
          <div aria-live="polite" className="text-sm break-words">
            {progress && <><p>{progress.label} {progress.percent}%</p><progress aria-label={progress.label} max={100} value={progress.percent} className="mt-2 w-full" /></>}
            {error && <p>{stopped ? "Scan cancelled. You can continue with manual verification." : error}</p>}
            {result && <p>{result.rawText ? "ID text extracted. Please review the extracted information before submitting." : fallback}</p>}
          </div>
          {result && <>
            <p className="text-sm">OCR Text Confidence: {result.confidence === null ? "Unavailable" : `${Math.round(result.confidence)}%`} <span className="block text-xs cc-text-muted">Text recognition quality only—not identity verification.</span></p>
            {(result.confidence === null || result.confidence < 70 || !Object.values(result.candidates).some(Boolean)) && <p className="text-sm cc-text-secondary">Some information could not be identified clearly. Check the image and enter or correct your information manually.</p>}
            <dl className="space-y-3 text-sm">
              {([ ["fullName", "Name"], ["dateOfBirth", "Date of Birth"], ["idType", "ID Type"] ] as const).map(([field, label]) => <div key={field} className="min-w-0">
                <dt className="cc-text-muted">{label} candidate</dt>
                <dd className="break-words">{result.candidates[field] || "Not detected"}</dd>
                {onUse && result.candidates[field] && <button className={`${button} mt-1`} type="button" onClick={() => onUse(field, result.candidates[field]!)}>Use this {label.toLowerCase()}</button>}
              </div>)}
            </dl>
            <details className="text-sm"><summary className="cursor-pointer">Show extracted text (sensitive)</summary><pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded-lg cc-surface-secondary p-3 text-xs">{result.rawText || "No readable text"}</pre></details>
          </>}
          <p className="text-xs cc-text-muted">Results stay in this component only and are discarded when you leave. Suggestions never overwrite your form automatically.</p>
        </div>
      </div>
    </section>
  );
}
