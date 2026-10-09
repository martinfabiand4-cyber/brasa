// Copies the text recognition runtime and its Spanish and English data into public/ocr,
// so the app reads scanned pages without a connection. Runs before dev and build.
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");

// The recognizer picks one of three LSTM cores by what the browser supports: relaxed SIMD
// (Chromium and WebView2), plain SIMD, or none. Each `.wasm.js` file carries its own wasm,
// so all three are needed and the separate `.wasm` binaries are not.
const files = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz", "lang/spa.traineddata.gz"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
];

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "lang"), { recursive: true });

for (const [from, to] of files) {
  const source = join(root, from);
  if (!existsSync(source)) {
    console.error(`copy-ocr: missing ${from}. Run npm install first.`);
    process.exit(1);
  }
  copyFileSync(source, join(out, to));
}
console.log(`copy-ocr: ${files.length} files copied to public/ocr`);
