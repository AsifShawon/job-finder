import { expect, test } from "@playwright/test";

test("search page shows filters", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: /Search Results/i })).toBeVisible();
  await expect(page.getByPlaceholder("Country")).toBeVisible();
});
