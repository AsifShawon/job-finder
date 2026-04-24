import { expect, test } from "@playwright/test";

test("landing page renders hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Overseas Opportunity Intelligence Platform/i })).toBeVisible();
});
