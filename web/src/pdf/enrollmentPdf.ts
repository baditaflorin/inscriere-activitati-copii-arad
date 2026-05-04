import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import type { Circle } from "../catalog";
import type { EnrollmentFormData } from "../formSchema";

const TEMPLATE_PATH = "assets/cerere-inscriere-Arad-2026-2027.pdf";
const FONT_PATH = "assets/fonts/NotoSans-Regular.ttf";

type PDFAssets = {
  templateBytes?: ArrayBuffer | Uint8Array;
  fontBytes?: ArrayBuffer | Uint8Array;
};

type DrawBox = {
  x: number;
  y: number;
  maxWidth: number;
  size?: number;
};

export async function generateEnrollmentPdf(
  form: EnrollmentFormData,
  circles: Circle[],
  assets: PDFAssets = {},
) {
  const [templateBytes, fontBytes] = await Promise.all([
    assets.templateBytes ?? fetchAsset(TEMPLATE_PATH),
    assets.fontBytes ?? fetchAsset(FONT_PATH),
  ]);

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const [page] = pdfDoc.getPages();
  const black = rgb(0.05, 0.06, 0.08);
  const blue = rgb(0.03, 0.26, 0.47);

  drawFittedText(page, font, form.parentName, { x: 95, y: 604, maxWidth: 455, size: 10.2 }, black);
  drawFittedText(page, font, form.childName, { x: 184, y: 576.5, maxWidth: 365, size: 10.2 }, black);
  drawFittedText(page, font, form.school, { x: 126, y: 549, maxWidth: 284, size: 10.2 }, black);
  drawFittedText(page, font, form.className, { x: 476, y: 549, maxWidth: 78, size: 10.2 }, black);
  drawCNP(page, font, form.cnp, { x: 82.2, y: 520.4, maxWidth: 183, size: 9.4 }, black);
  drawFittedText(page, font, form.address, { x: 62, y: 493.8, maxWidth: 296, size: 10.2 }, black);
  drawFittedText(page, font, form.phone, { x: 400, y: 493.8, maxWidth: 150, size: 10.2 }, black);
  drawWrappedText(page, font, makeCircleText(circles), { x: 207, y: 466.2, maxWidth: 344, size: 9.2 }, blue, 2);
  drawFittedText(page, font, formatRomanianDate(form.date), { x: 145, y: 104, maxWidth: 120 }, black);
  drawFittedText(page, font, form.parentSignature, { x: 370, y: 126, maxWidth: 170, size: 10.2 }, black);
  drawConsentMark(page, form.consent, blue);

  return pdfDoc.save({ useObjectStreams: false });
}

function drawCNP(page: PDFPage, font: PDFFont, text: string, box: DrawBox, color = rgb(0, 0, 0)) {
  const digits = compact(text).slice(0, 13).split("");
  const cellWidth = 14.67;
  const size = box.size ?? 9.4;
  digits.forEach((digit, index) => {
    const digitWidth = font.widthOfTextAtSize(digit, size);
    page.drawText(digit, {
      x: box.x + index * cellWidth + (cellWidth - digitWidth) / 2,
      y: box.y,
      size,
      font,
      color,
    });
  });
}

function drawConsentMark(page: PDFPage, consent: EnrollmentFormData["consent"], color = rgb(0, 0, 0)) {
  page.drawRectangle({
    x: consent === "DA" ? 12.4 : 41.5,
    y: 391.2,
    width: 21,
    height: 13,
    borderColor: color,
    borderWidth: 1.1,
  });
}

export function makeCircleText(circles: Circle[]) {
  return circles.map((circle) => circle.name).join("; ");
}

function fetchAsset(path: string) {
  const url = `${import.meta.env.BASE_URL}${path}`;
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Nu am putut incarca asset-ul PDF: ${path}`);
    }
    return response.arrayBuffer();
  });
}

function drawFittedText(page: PDFPage, font: PDFFont, text: string, box: DrawBox, color = rgb(0, 0, 0)) {
  const clean = compact(text);
  const size = fittedSize(font, clean, box.maxWidth, box.size ?? 10.5, 7);
  page.drawText(clean, {
    x: box.x,
    y: box.y,
    size,
    font,
    color,
  });
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: DrawBox,
  color = rgb(0, 0, 0),
  maxLines = 4,
) {
  const size = box.size ?? 9;
  const lines = wrapText(font, compact(text), box.maxWidth, size, maxLines);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: box.x,
      y: box.y - index * (size + 2.5),
      size,
      font,
      color,
    });
  });
}

export function wrapText(font: PDFFont, text: string, maxWidth: number, size: number, maxLines: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length > 0 && words.join(" ") !== lines.join(" ")) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = trimToWidth(font, `${last}...`, maxWidth, size);
  }
  return lines;
}

function trimToWidth(font: PDFFont, text: string, maxWidth: number, size: number) {
  let candidate = text;
  while (candidate.length > 3 && font.widthOfTextAtSize(candidate, size) > maxWidth) {
    candidate = `${candidate.slice(0, -4)}...`;
  }
  return candidate;
}

function fittedSize(font: PDFFont, text: string, maxWidth: number, preferred: number, minimum: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function compact(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function formatRomanianDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}.${month}.${year}`;
}
