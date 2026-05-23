import { expect, test } from "@playwright/test";

type QuickAccessItem = {
  category_key: string;
  country: string;
};

const API_BASE = process.env.SERVER_API_BASE_URL ?? "http://localhost:8000";

test("home quick access mirrors the dynamic API response", async ({ page, request, context }) => {
  await context.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      url: "http://localhost:3001",
    },
  ]);

  const response = await request.get(`${API_BASE}/api/v1/opportunities/quick-access`);
  expect(response.ok()).toBeTruthy();
  const items = (await response.json()) as QuickAccessItem[];

  await page.goto("/");

  const links = page.getByTestId("quick-access-link");
  await expect(links).toHaveCount(items.length);

  for (let i = 0; i < items.length; i += 1) {
    const params = new URLSearchParams({
      opportunity_type: "overseas_job,local_job",
      isc_category_key: items[i].category_key,
      country: items[i].country,
    });
    await expect(links.nth(i)).toHaveAttribute("href", `/search?${params.toString()}`);
  }
});
