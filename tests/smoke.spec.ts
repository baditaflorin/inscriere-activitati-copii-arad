import { expect, test, type Locator } from "@playwright/test";

test("fills enrollment data and downloads a PDF", async ({ page }) => {
  const consoleErrors: string[] = [];
  const clickCentered = async (target: Locator) => {
    await target.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
    await expect(target).toBeVisible();
    try {
      await target.click({ timeout: 5_000 });
    } catch {
      await target.click({ force: true });
    }
  };
  const tapCircle = async (testId: string) => clickCentered(page.getByTestId(testId));

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  await expect(page.getByRole("heading", { name: /Inscrieri Palatul Copiilor Arad/ })).toBeVisible();
  await expect(page.getByText(/Frontend v0.1.0/).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.getByPlaceholder(/Cauta un cerc/).fill("sah");
  await tapCircle("circle-card-sah");
  await page.getByPlaceholder(/Cauta un cerc/).fill("desen");
  await tapCircle("circle-card-desen-pictura");
  await expect(page.getByText("2 cercuri selectate").first()).toBeVisible();
  await expect(page.getByTestId("circle-image-desen-pictura")).toBeVisible();

  await page.getByRole("textbox", { name: "Nume si prenume parinte" }).fill("Popescu Maria");
  await page.getByRole("textbox", { name: "Semnatura parinte / tutore" }).fill("Popescu Maria");
  await page.getByRole("textbox", { name: "Nume si prenume copil" }).fill("Popescu Ana");
  await page.getByRole("textbox", { name: "Gradinita / scoala" }).fill("Scoala Gimnaziala Mihai Eminescu");
  await page.getByRole("textbox", { name: "Grupa / clasa" }).fill("III");
  await page.getByRole("textbox", { name: "CNP copil" }).fill("6123456789012");
  await page.getByRole("textbox", { name: "Telefon" }).fill("0712 345 678");
  await page.getByRole("textbox", { name: "Adresa" }).fill("Strada Exemplu 10, Arad");
  await page.getByLabel("Data cererii", { exact: true }).fill("2026-05-04");
  await expect(page.getByRole("link", { name: /Deschide in Gmail/i })).toHaveAttribute("href", /mail\.google\.com/);
  await expect(page.getByLabel("Mesaj")).toHaveValue(/Popescu Ana/);

  const downloadPromise = page.waitForEvent("download");
  await clickCentered(page.getByRole("button", { name: /Genereaza 2 PDF-uri/i }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/cereri-inscriere-popescu-ana\.zip/);

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
  expect(size).toBeGreaterThan(200_000);
  expect(consoleErrors).toEqual([]);
});
