import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNarratedVoiceText,
  formatVoiceDate,
  getVoiceField,
  getVoiceList,
  normalizeSpeechText,
} from "../lib/voice-script.ts";

test("Bangla voice fields prefer Bangla-localized content", () => {
  const record = {
    title: "Generic title",
    title_bn: "বাংলা শিরোনাম",
    title_en: "English title",
  };

  assert.equal(getVoiceField(record, "title", "bn"), "বাংলা শিরোনাম");
});

test("Bangla voice skips English-only fallback content", () => {
  const record = {
    summary: null,
    summary_bn: null,
    summary_en: "This is only available in English",
  };

  assert.equal(getVoiceField(record, "summary", "bn"), null);
});

test("Bangla voice localizes known country names and Bangla lists", () => {
  const record = {
    country: "Malaysia",
    journey_steps: ["Apply online"],
    journey_steps_bn: ["অনলাইনে আবেদন করুন", "সাক্ষাৎকার দিন"],
  };

  assert.equal(getVoiceField(record, "country", "bn"), "মালয়েশিয়া");
  assert.deepEqual(getVoiceList(record, "journey_steps", "bn"), ["অনলাইনে আবেদন করুন", "সাক্ষাৎকার দিন"]);
});

test("speech normalization removes urls and formats Bangla-friendly tokens", () => {
  const normalized = normalizeSpeechText(
    "বিস্তারিত দেখুন: https://example.com/apply BDT 50000 & থাকা",
    "bn",
  );

  assert.ok(normalized);
  assert.equal(normalized.includes("http"), false);
  assert.equal(normalized.includes("টাকা"), true);
  assert.equal(normalized.includes("এবং"), true);
});

test("Bangla narrated voice text keeps labels and speech punctuation", () => {
  const spoken = buildNarratedVoiceText("সারসংক্ষেপ", ["প্রথম লাইন", "দ্বিতীয় লাইন"], "bn");

  assert.equal(spoken, "সারসংক্ষেপ, প্রথম লাইন। দ্বিতীয় লাইন।");
});

test("Bangla voice dates are formatted for speech", () => {
  const spokenDate = formatVoiceDate("2026-05-20", "bn");

  assert.ok(spokenDate);
  assert.match(spokenDate, /[\u0980-\u09FF]/u);
});
