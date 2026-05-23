import { expect, test, type Page } from "@playwright/test";

async function getHeroHeading(page: Page) {
  const heading = page.getByTestId("hero-slide-title");
  return (await heading.textContent())?.trim() ?? "";
}

test("landing page renders hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero-slide-title")).toBeVisible();
});

test("hero autoplay pauses while the user types and resumes after the draft is cleared", async ({ page }) => {
  await page.goto("/");

  const initialHeading = await getHeroHeading(page);
  const questionInput = page.getByTestId("hero-ai-input");

  await questionInput.fill("What documents do I need for Malaysia?");
  await page.waitForTimeout(6500);

  await expect(questionInput).toHaveValue("What documents do I need for Malaysia?");
  await expect.poll(() => getHeroHeading(page)).toBe(initialHeading);

  await questionInput.clear();
  await page.waitForTimeout(6500);

  await expect.poll(() => getHeroHeading(page)).not.toBe(initialHeading);
});

test("hero autoplay pauses after the mic button is pressed", async ({ page }) => {
  await page.addInitScript(() => {
    class MockSpeechRecognition {
      continuous = false;
      interimResults = true;
      lang = "en-US";
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;

      start() {
        window.setTimeout(() => {
          this.onstart?.();
        }, 10);
      }

      stop() {
        this.onend?.();
      }

      abort() {
        this.onend?.();
      }
    }

    window.SpeechRecognition = MockSpeechRecognition;
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  await page.goto("/");

  const initialHeading = await getHeroHeading(page);
  const micButton = page.getByTestId("hero-voice-toggle");

  await micButton.click();
  await page.waitForTimeout(6500);

  await expect.poll(() => getHeroHeading(page)).toBe(initialHeading);
});
