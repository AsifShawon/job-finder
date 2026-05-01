import { expect, test } from "@playwright/test";

test("search page shows filters", async ({ page }) => {
  await page.goto("/search");

  await expect(
    page.getByRole("heading", {
      name: /যাচাইকৃত সুযোগ খুঁজুন|Find Verified Opportunities/i,
    }),
  ).toBeVisible();

  await expect(page.getByText(/Categories|ক্যাটাগরি/i)).toBeVisible();
  await expect(page.getByText(/কোন দেশে|Which country/i)).toBeVisible();
});
