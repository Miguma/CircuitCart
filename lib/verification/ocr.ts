import type { Worker } from "tesseract.js";
import { parseIdText, type OcrCandidates } from "./ocr-parser";

export interface OcrResult {
  rawText: string;
  candidates: OcrCandidates;
  confidence: number | null;
}
export interface OcrProgress { label: string; percent: number }

export async function validateIdImage(file: Blob): Promise<void> {
  if (!file.size || file.size > 5 * 1024 * 1024 || !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) throw new Error("Invalid image");
  const image = await createImageBitmap(file);
  try {
    if (!image.width || !image.height || image.width * image.height > 40_000_000) throw new Error("Image dimensions too large");
  } finally { image.close(); }
}

/** One worker per explicit scan, disposed on success, failure, cancel or unmount.
 * No uploads, backend writes, persistent result cache or logging in this module.
 */
export function readIdText(file: Blob, onProgress: (value: OcrProgress) => void) {
  let worker: Worker | null = null;
  let cancelled = false;
  let rejectCancelled: (reason: Error) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectCancelled = reject; });
  const dispose = () => {
    if (worker) { void worker.terminate().catch(() => {}); worker = null; }
  };
  const cancel = () => {
    cancelled = true;
    dispose();
    rejectCancelled(new Error("OCR cancelled"));
  };
  const timeout = setTimeout(cancel, 90_000);
  const task = (async (): Promise<OcrResult> => {
    await validateIdImage(file);
    if (cancelled) throw new Error("OCR cancelled");
    const { createWorker } = await import("tesseract.js");
    if (cancelled) throw new Error("OCR cancelled");
    worker = await createWorker("eng", 1, {
      workerPath: "/ocr-worker.js",
      workerBlobURL: false,
      cacheMethod: "none",
      logger: (event) => {
        if (cancelled) return;
        const reading = event.status === "recognizing text";
        onProgress({ label: reading ? "Reading ID..." : "Loading OCR engine...", percent: reading ? Math.round(30 + Math.max(0, Math.min(1, event.progress || 0)) * 65) : 15 });
      },
      errorHandler: () => {},
    });
    // createWorker resolves asynchronously; also dispose if cancelled during initialization.
    if (cancelled) { dispose(); throw new Error("OCR cancelled"); }
    const { data } = await worker.recognize(file);
    if (cancelled) throw new Error("OCR cancelled");
    onProgress({ label: "Processing text...", percent: 98 });
    const rawText = data.text.trim();
    return { rawText, candidates: parseIdText(rawText), confidence: Number.isFinite(data.confidence) ? Math.max(0, Math.min(100, data.confidence)) : null };
  })();
  return {
    cancel,
    result: Promise.race([task, interrupted]).finally(() => { clearTimeout(timeout); dispose(); }),
  };
}
