import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { test } from "node:test";

const read = (path) => readFileSync(path, "utf8");
function moduleFrom(path, dependencies = {}) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  }, loaded, loaded.exports);
  return loaded.exports;
}
const parser = moduleFrom("lib/verification/ocr-parser.ts");

test("conservative parser recognizes labeled synthetic data", () => {
  assert.deepEqual(parser.parseIdText("PHILIPPINE NATIONAL ID\nFull Name: SAMPLE TEST PERSON\nDate of Birth: 1995-03-14"), {
    fullName: "SAMPLE TEST PERSON", dateOfBirth: "1995-03-14", idType: "Philippine National ID (PhilID)",
  });
});
test("unknown, ambiguous, invalid and random text does not invent fields", () => {
  assert.deepEqual(parser.parseIdText(""), {fullName:null, dateOfBirth:null, idType:null});
  assert.equal(parser.parseIdText("A laptop on a table").fullName, null);
  for (const birth of ["03/04/1995", "1995-02-31", "2995-01-01"]) assert.equal(parser.parseIdText(`DOB: ${birth}`).dateOfBirth, null);
  assert.equal(parser.parseIdText("Name:\nDate of Birth: 1995-03-14").fullName, null);
  assert.equal(parser.parseIdText("DOB: 14 March 1995").dateOfBirth, "1995-03-14");
  assert.equal(parser.parseIdText("PASSPORT UMID").idType, null);
});

test("worker uses modern API, disposes, and handles cancellation/failure", async () => {
  let terminated = 0;
  let recognized = 0;
  let options;
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({width:1200,height:700,close(){}});
  const createWorker = async (_lang, _mode, opts) => {
    options = opts;
    return {recognize: async () => { recognized++; return {data:{text:"Name: SAMPLE TEST PERSON",confidence:89}}; }, terminate: async () => {terminated++;}};
  };
  try {
    const ocr = moduleFrom("lib/verification/ocr.ts", {"./ocr-parser":parser,"tesseract.js":{createWorker}});
    const file = new Blob(["synthetic"], {type:"image/png"});
    const result = await ocr.readIdText(file, () => {}).result;
    assert.equal(result.confidence,89);
    assert.equal(terminated,1);
    assert.equal(recognized,1);
    assert.equal(options.cacheMethod,"none");
    const cancel = ocr.readIdText(file, () => {}); cancel.cancel();
    await assert.rejects(cancel.result);
    for (const invalid of [new Blob([],{type:"image/png"}),new Blob(["x"],{type:"application/pdf"}),new Blob([new Uint8Array(5*1024*1024+1)],{type:"image/png"})]) await assert.rejects(ocr.readIdText(invalid,()=>{}).result);
    globalThis.createImageBitmap = async () => {throw new Error("corrupt");};
    await assert.rejects(ocr.readIdText(file,()=>{}).result);
    globalThis.createImageBitmap = async () => ({width:1,height:1,close(){}});
    const failed = moduleFrom("lib/verification/ocr.ts", {"./ocr-parser":parser,"tesseract.js":{createWorker:async()=>{throw new Error("offline");}}});
    await assert.rejects(failed.readIdText(file,()=>{}).result);
  } finally {globalThis.createImageBitmap = original;}
});

test("active submission and processor have no automatic approval or OCR persistence", () => {
  const seller = read("app/seller/verification/page.tsx");
  const edge = read("supabase/functions/process-seller-verification/index.ts");
  const ocr = read("lib/verification/ocr.ts") + read("components/verification/id-ocr-panel.tsx");
  assert.doesNotMatch(seller,/triggerAutomatedVerification|auto_approve|automated_score/);
  assert.doesNotMatch(edge,/\.rpc\(|\.from\(|SUPABASE_SERVICE|automated_score|auto_approve/);
  assert.match(edge,/status: 410/);
  assert.doesNotMatch(ocr,/localStorage|sessionStorage|console\.|\.rpc\(|\.from\(|automated_score/);
  assert.match(seller,/window\.confirm/);
  assert.match(read("app/admin/verifications/[id]/page.tsx"),/reviewSellerVerification\(request.id, "approved"\)/);
  assert.match(read("lib/supabase/verification.ts"),/"review_seller_verification"/);
});

test("late worker initialization is disposed after unmount; recognition failure also disposes", async () => {
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({width:1,height:1,close(){}});
  let finishInit;
  let terminated = 0;
  let recognized = 0;
  const worker = {terminate:async()=>{terminated++;},recognize:async()=>{recognized++;throw new Error("recognition failed");}};
  const initialized = new Promise(resolve=>{finishInit=resolve;});
  const file = new Blob(["synthetic"],{type:"image/png"});
  try {
    const ocr = moduleFrom("lib/verification/ocr.ts", {"./ocr-parser":parser,"tesseract.js":{createWorker:()=>initialized}});
    const job = ocr.readIdText(file,()=>{});
    await new Promise(resolve=>setImmediate(resolve));
    job.cancel();
    await assert.rejects(job.result);
    finishInit(worker);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(terminated,1);
    assert.equal(recognized,0);
    await assert.rejects(ocr.readIdText(file,()=>{}).result);
    assert.equal(terminated,2);
    assert.equal(recognized,1);
  } finally {globalThis.createImageBitmap=original;}
});
