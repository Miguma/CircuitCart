/* CircuitCart OCR worker bootstrap. Keep the version aligned with package.json.
 * A failed initialization in Tesseract may not return a worker handle to dispose.
 * This bounded lifetime also closes those workers. No document data is logged.
 */
setTimeout(() => self.close(), 95000);
self.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  self.close();
});
try {
  importScripts("https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js");
} catch {
  self.close();
}
