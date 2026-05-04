import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Circle } from "../web/src/catalog";
import type { EnrollmentFormData } from "../web/src/formSchema";
import { generateEnrollmentPdf } from "../web/src/pdf/enrollmentPdf";

const templateBytes = toArrayBuffer(readFileSync(resolve("web/public/assets/cerere-inscriere-Arad-2026-2027.pdf")));
const fontBytes = toArrayBuffer(readFileSync(resolve("web/public/assets/fonts/NotoSans-Regular.ttf")));

const form: EnrollmentFormData = {
  parentName: "Popescu Maria",
  parentSignature: "Semnatura Popescu Maria",
  childName: "Popescu Ana",
  school: "Scoala Gimnaziala Mihai Eminescu",
  className: "III",
  cnp: "6123456789012",
  address: "Strada Exemplu 10, Arad",
  phone: "0712 345 678",
  consent: "DA",
  date: "2026-05-04",
};

const circles: Circle[] = [
  { id: "sah", name: "Șah", category: "Sportive", sessions: [] },
];

const tempDir = mkdtempSync(join(tmpdir(), "pcarad-pdf-"));
try {
  const outputPath = join(tempDir, "cerere.pdf");
  const bytes = await generateEnrollmentPdf(form, circles, { templateBytes, fontBytes });
  writeFileSync(outputPath, bytes);
  if (bytes.byteLength <= templateBytes.byteLength) {
    throw new Error("generated PDF is not larger than the official template");
  }
  const extractedText = execFileSync("pdftotext", ["-layout", outputPath, "-"], { encoding: "utf8" });
  for (const expected of ["Popescu Maria", "Semnatura Popescu Maria", "Popescu Ana", "Șah"]) {
    if (!extractedText.includes(expected)) {
      throw new Error(`generated PDF text does not include ${expected}`);
    }
  }
  console.log(`PDF smoke OK: ${outputPath}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function toArrayBuffer(bytes: Buffer) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
