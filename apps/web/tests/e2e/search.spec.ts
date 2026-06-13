import { expect, test } from "@playwright/test";

test("search page shows filters", async ({ page }) => {
  await page.goto("/search");

  await expect(
    page.getByRole("heading", {
      name: /আপনার জন্য সুযোগ খুঁজুন|Find opportunities for you/i,
    }),
  ).toBeVisible();

  await expect(page.getByText(/Categories|ক্যাটাগরি/i).first()).toBeVisible();
  await expect(page.getByText(/কোন দেশে|Which country/i).first()).toBeVisible();
});
