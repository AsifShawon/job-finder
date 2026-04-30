import { expect, test } from "@playwright/test";

test("landing page renders hero", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /বিদেশে কাজের সুযোগ খুঁজুন|Find Your Overseas Opportunity/i,
    }),
  ).toBeVisible();
});
