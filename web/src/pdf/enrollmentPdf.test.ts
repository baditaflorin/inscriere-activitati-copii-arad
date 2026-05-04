import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Circle } from "../catalog";
import type { EnrollmentFormData } from "../formSchema";
import { generateEnrollmentPdf, makeCircleText } from "./enrollmentPdf";

const templateBytes = toArrayBuffer(
  readFileSync(resolve(process.cwd(), "web/public/assets/cerere-inscriere-Arad-2026-2027.pdf")),
);
const fontBytes = toArrayBuffer(readFileSync(resolve(process.cwd(), "web/public/assets/fonts/NotoSans-Regular.ttf")));

const form: EnrollmentFormData = {
  parentName: "Popescu Maria",
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
  { id: "desen-pictura", name: "Desen / Pictură", category: "Artistice", sessions: [] },
];

describe("generateEnrollmentPdf", () => {
  it("joins selected circles for the official field", () => {
    expect(makeCircleText(circles)).toBe("Șah; Desen / Pictură");
  });

  it("generates a non-empty official PDF", async () => {
    const pdf = await generateEnrollmentPdf(form, circles, { templateBytes, fontBytes });
    expect(pdf.byteLength).toBeGreaterThan(templateBytes.byteLength);
    expect(pdf[0]).toBe(0x25);
    expect(pdf[1]).toBe(0x50);
    expect(pdf[2]).toBe(0x44);
    expect(pdf[3]).toBe(0x46);
  });
});

function toArrayBuffer(bytes: Buffer) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
