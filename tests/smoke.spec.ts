import { expect, test } from "@playwright/test";

test("fills enrollment data and downloads a PDF", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Inscriere la cercuri" })).toBeVisible();
  await expect(page.getByText("v0.1.0").first()).toBeVisible();

  await page.getByPlaceholder(/Cauta dupa cerc/).fill("sah");
  await page.getByRole("checkbox", { name: /Șah/i }).click();
  await expect(page.getByText("1 selectate")).toBeVisible();

  await page.getByRole("textbox", { name: "Parinte / tutore" }).fill("Popescu Maria");
  await page.getByRole("textbox", { name: "Copil", exact: true }).fill("Popescu Ana");
  await page.getByRole("textbox", { name: "Gradinita / scoala" }).fill("Scoala Gimnaziala Mihai Eminescu");
  await page.getByRole("textbox", { name: "Grupa / clasa" }).fill("III");
  await page.getByRole("textbox", { name: "CNP copil" }).fill("6123456789012");
  await page.getByRole("textbox", { name: "Telefon" }).fill("0712 345 678");
  await page.getByRole("textbox", { name: "Adresa" }).fill("Strada Exemplu 10, Arad");
  await page.getByLabel("Data cererii", { exact: true }).fill("2026-05-04");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Genereaza PDF-ul/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/cerere-inscriere-popescu-ana\.pdf/);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const stream = await download.createReadStream();
  let size = 0;
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => {
      size += chunk.length;
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });
  expect(size).toBeGreaterThan(100_000);
  expect(consoleErrors).toEqual([]);
});
