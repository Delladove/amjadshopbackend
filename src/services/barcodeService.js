const db = require("../db-old/db");

/* Every product gets a unique, scannable EAN-13 barcode the moment it's created.
   We use the "20"-"29" prefix range, which is the GS1-reserved block for in-store /
   restricted-circulation numbers — exactly how independent shops assign their own
   barcodes without a registered manufacturer prefix. A running counter (kept in the
   settings table) guarantees every code is unique; a real EAN-13 check digit makes
   it genuinely scannable by any standard barcode scanner or phone camera. */

function ean13CheckDigit(digits12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function getNextSeq() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'next_barcode_seq'").get();
  const current = row ? parseInt(row.value, 10) : 1;
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('next_barcode_seq', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(current + 1));
  return current;
}

function generateBarcode() {
  const seq = getNextSeq();
  const core = "20" + String(seq).padStart(10, "0"); // 12 digits total
  return core + ean13CheckDigit(core);
}

function isValidEan13(code) {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

module.exports = { generateBarcode, ean13CheckDigit, isValidEan13 };
