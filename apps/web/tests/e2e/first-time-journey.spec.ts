import { expect, test } from "@playwright/test";

function getCleanDecodedUrl(url: string): string {
  let decoded = decodeURIComponent(url).replace(/\+/g, " ");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {}
  return decoded;
}

test("First-time user journey redirects from copilot to login, register, onboarding, and back to copilot with context preserved", async ({ page }) => {
  const query = "q=SSC%20%E0%A6%AA%E0%A6%BE%E0%A6%B8%E0%A7%87%20%E0%A6%95%E0%A7%80%20%E0%A6%9A%E0%A6%BE%E0%A6%95%E0%A6%B0%E0%A6%BF%20%E0%A6%86%E0%A6%9B%E0%A7%87";
  const targetCopilot = `/copilot?${query}`;

  // 1. Visit /copilot as anonymous user -> should redirect to login page with next param
  await page.goto(targetCopilot);
  await page.waitForURL(/\/auth\/login/);
  expect(getCleanDecodedUrl(page.url())).toContain("next=/copilot?q=SSC পাসে কী চাকরি আছে");

  // 2. Click on the register link -> next param should be preserved
  const registerLink = page.locator('a[href*="/auth/register?next="]').first();
  await expect(registerLink).toBeVisible();
  await registerLink.click();

  await page.waitForURL(/\/auth\/register/);
  expect(getCleanDecodedUrl(page.url())).toContain("next=/copilot?q=SSC পাসে কী চাকরি আছে");

  // Verify custom Bangla helper copy is displayed
  const helperText = page.locator('p:has-text("আপনার প্রশ্নটি আমরা মনে রাখছি")').filter({ visible: true });
  await expect(helperText).toBeVisible();

  // 3. Register a new user
  const email = `test-${Date.now()}@example.com`;
  await page.locator('input[placeholder="আপনার পূর্ণ নাম"]').fill("Test User");
  await page.locator('input[placeholder="you@example.com"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");

  // Click register button
  const registerButton = page.locator('button:has-text("অ্যাকাউন্ট তৈরি করুন")');
  await registerButton.click();

  // 4. Registration success -> should redirect to onboarding preserving next param
  await page.waitForURL(/\/onboarding/);
  expect(getCleanDecodedUrl(page.url())).toContain("next=/copilot?q=SSC পাসে কী চাকরি আছে");

  // Verify custom Bangla onboarding helper copy is displayed (filtering for the visible desktop/mobile element)
  const onboardingHelperText = page.locator('p:has-text("আরও ভালো চাকরি দেখানোর জন্য কয়েকটি সহজ তথ্য দিন।")').filter({ visible: true });
  await expect(onboardingHelperText).toBeVisible();

  // 5. On onboarding page, click skip
  const skipButton = page.locator('button:has-text("এখন এড়িয়ে যান")');
  await expect(skipButton).toBeVisible();
  await skipButton.click();

  // 6. Skip onboarding -> should redirect back to /copilot with original query preserved
  await page.waitForURL(/\/copilot/);
  expect(getCleanDecodedUrl(page.url())).toContain("q=SSC পাসে কী চাকরি আছে");
});

test("First-time user journey validates next URL to reject open redirect to evil.com", async ({ page }) => {
  const evilRedirect = "https://evil.com/attacker-controlled";
  
  // 1. Visit /onboarding with an evil next URL as anonymous user -> should redirect to login page with evil next
  await page.goto(`/onboarding?next=${encodeURIComponent(evilRedirect)}`);
  await page.waitForURL(/\/auth\/login/);
  expect(getCleanDecodedUrl(page.url())).toContain(`next=${evilRedirect}`);

  // 2. Register a new user with evil next
  const email = `test-evil-${Date.now()}@example.com`;
  const registerLink = page.locator('a[href*="/auth/register?next="]').first();
  await registerLink.click();
  await page.waitForURL(/\/auth\/register/);

  await page.locator('input[placeholder="আপনার পূর্ণ নাম"]').fill("Test Evil User");
  await page.locator('input[placeholder="you@example.com"]').fill(email);
  await page.locator('input[type="password"]').fill("password123");

  const registerButton = page.locator('button:has-text("অ্যাকাউন্ট তৈরি করুন")');
  await registerButton.click();

  // 3. On onboarding page (with evil next in query), click skip
  await page.waitForURL(/\/onboarding/);
  expect(getCleanDecodedUrl(page.url())).toContain(`next=${evilRedirect}`);

  const skipButton = page.locator('button:has-text("এখন এড়িয়ে যান")');
  await skipButton.click();

  // 4. Safe fallback -> should redirect to dashboard, NOT to evil.com
  await page.waitForURL(/\/dashboard/);
  expect(page.url()).not.toContain("evil.com");
});
