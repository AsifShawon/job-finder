import type { Locale } from "./i18n-shared";

export interface LocalizedString {
  bn: string;
  en: string;
}

export const UX_COPY = {
  homepageHero: {
    title: {
      bn: "আপনার জন্য নিরাপদ চাকরি খুঁজে দিন",
      en: "Find Safe Jobs for You",
    },
    subtitle: {
      bn: "কী কাজ পারেন বলুন, আমরা মিল থাকা সুযোগ দেখাবো।",
      en: "Tell us what work you can do, and we will show matching opportunities.",
    },
  },
  heroVoiceInput: {
    label: {
      bn: "সুদক্ষ AI ভয়েস সহকারী",
      en: "Sudokkho AI Voice Assistant",
    },
    labelMobile: {
      bn: "সুদক্ষ AI কে বলুন",
      en: "Ask Sudokkho AI",
    },
    placeholderListening: {
      bn: "শুনছি...",
      en: "Listening...",
    },
    placeholderIdle: {
      bn: "বিদেশের চাকরি নিয়ে বলুন",
      en: "Ask about overseas jobs",
    },
    helperTextListening: {
      bn: "স্বাভাবিকভাবে বলুন। শেষ হলে সুদক্ষ AI খুলবে।",
      en: "Speak naturally. We will open Sudokkho AI when you finish.",
    },
    helperTextIdle: {
      bn: "ভয়েসে বলুন অথবা লিখে প্রশ্ন করুন।",
      en: "Use voice or type your question.",
    },
    stopListeningAria: {
      bn: "শোনা বন্ধ করুন",
      en: "Stop listening",
    },
    startListeningAria: {
      bn: "ভয়েস ইনপুট শুরু করুন",
      en: "Start voice input",
    },
    sendAria: {
      bn: "সুদক্ষ AI তে পাঠান",
      en: "Send to Sudokkho AI",
    },
  },
  samplePrompts: [
    {
      bn: "SSC পাসে কোন দেশে কাজ পাবো?",
      en: "Which countries hire SSC-pass workers?",
    },
    {
      bn: "মালয়েশিয়া যেতে কত খরচ লাগবে?",
      en: "How much does it cost to go to Malaysia?",
    },
    {
      bn: "জার্মানি Ausbildung কীভাবে করবো?",
      en: "How do I apply for German Ausbildung?",
    },
    {
      bn: "কানাডায় নার্স হিসেবে কাজ করতে কী লাগবে?",
      en: "What do I need to work as a nurse in Canada?",
    },
  ],
  voiceStates: {
    listening: {
      bn: "শুনছি...",
      en: "Listening...",
    },
    processing: {
      bn: "ভাবছি...",
      en: "Thinking...",
    },
    unsupported: {
      bn: "ভয়েস চালু হয়নি। প্রশ্নটি লিখে পাঠাতে পারেন।",
      en: "Voice is not available. Type your question instead.",
    },
    permissionDenied: {
      bn: "মাইক ব্যবহারের অনুমতি দেওয়া হয়নি। দয়া করে অনুমতি দিন বা লিখে পাঠান।",
      en: "Microphone access denied. Please grant permission or type your question.",
    },
    noSpeech: {
      bn: "কোনো কথা শোনা যায়নি। আবার চেষ্টা করুন বা লিখে প্রশ্ন করুন।",
      en: "No speech detected. Please try again or type your question.",
    },
    errorFallback: {
      bn: "ভয়েস সংযোগে সমস্যা হয়েছে। লিখে চেষ্টা করুন।",
      en: "Voice connection failed. Please type your question.",
    },
  },
  signupPrompt: {
    title: {
      bn: "সহজেই এগিয়ে যান",
      en: "Move forward easily",
    },
    subtitle: {
      bn: "আপনার প্রশ্নটির উত্তর পেতে ও চাকরি খুঁজতে দয়া করে লগইন করুন।",
      en: "Please log in to get the answer to your question and find jobs.",
    },
  },
  onboardingQuestions: {
    step1Title: {
      bn: "আপনি কোন ধরনের কাজ করতে চান?",
      en: "What kind of work do you want to do?",
    },
    step1Subtitle: {
      bn: "কমপক্ষে ২টি কাজ বেছে নিন (সর্বোচ্চ ৩টি)",
      en: "Choose at least 2 types of work (max 3)",
    },
    step2Title: {
      bn: "আপনি কোন দেশে যেতে চান?",
      en: "Which country do you want to go to?",
    },
    step2Subtitle: {
      bn: "আপনার পছন্দের দেশগুলো বেছে নিন",
      en: "Select your preferred countries",
    },
    step3Title: {
      bn: "বর্তমানে আপনার কাজের অবস্থা কী?",
      en: "What is your current work status?",
    },
    step3Subtitle: {
      bn: "নিচের যেকোনো একটি বেছে নিন",
      en: "Please select one from below",
    },
    step4Title: {
      bn: "আপনার পড়াশোনা কতটুকু?",
      en: "What is your education level?",
    },
    step4Subtitle: {
      bn: "নিচের যেকোনো একটি বেছে নিন",
      en: "Please select one from below",
    },
  },
  recommendationLabels: {
    whyItMatches: {
      bn: "এই কাজটি আপনার জন্য ভালো কারণ:",
      en: "This job is a good fit for you because:",
    },
    documentsNeeded: {
      bn: "প্রয়োজনীয় কাগজপত্র:",
      en: "Required documents:",
    },
    bdEligibilityYes: {
      bn: "বাংলাদেশ থেকে সরাসরি আবেদন করা যাবে",
      en: "Can apply directly from Bangladesh",
    },
    bdEligibilityNo: {
      bn: "বাংলাদেশ থেকে সরাসরি আবেদন করা যাবে না",
      en: "Cannot apply directly from Bangladesh",
    },
    bdEligibilityUnknown: {
      bn: "বাংলাদেশীদের জন্য সুযোগের তথ্য অজানা",
      en: "Bangladesh eligibility status unknown",
    },
  },
  opportunityCardLabels: {
    salary: {
      bn: "বেতন:",
      en: "Salary:",
    },
    deadline: {
      bn: "শেষ তারিখ:",
      en: "Deadline:",
    },
    education: {
      bn: "পড়াশোনা:",
      en: "Education:",
    },
    experience: {
      bn: "অভিজ্ঞতা:",
      en: "Experience:",
    },
    listenButton: {
      bn: "শুনুন",
      en: "Listen",
    },
    detailsButton: {
      bn: "বিস্তারিত দেখুন",
      en: "See Details",
    },
  },
  safetyWarnings: {
    officialSource: {
      bn: "এটি সরকারি বা বিশ্বস্ত সূত্র থেকে নেওয়া হয়েছে।",
      en: "This is collected from an official or high-trust source.",
    },
    partnerSource: {
      bn: "এটি অফিশিয়াল পার্টনার থেকে পাওয়া সুযোগ।",
      en: "This opportunity is from an official partner.",
    },
    needsReview: {
      bn: "সাবধান! এই তথ্যটি ভালো করে পড়ে নেওয়া প্রয়োজন। কোনো টাকা লেনদেন করবেন না।",
      en: "Caution! Please read this information carefully. Do not transfer any money.",
    },
    generalSafety: {
      bn: "দালাল বা কাউকে টাকা দেওয়ার আগে সরকারি অফিসে যোগাযোগ করুন।",
      en: "Contact official government offices before paying any agents.",
    },
  },
  applySteps: {
    header: {
      bn: "আবেদন করার নিয়ম:",
      en: "How to apply:",
    },
    step1: {
      bn: "১. চাকরির প্রয়োজনীয় কাগজপত্র সংগ্রহ করুন।",
      en: "1. Gather the required documents for the job.",
    },
    step2: {
      bn: "২. নিচে দেওয়া সরকারি বা নির্ভরযোগ্য লিংকটি খুলুন।",
      en: "2. Open the official or trusted link provided below.",
    },
    step3: {
      bn: "৩. কোনো সাহায্য লাগলে সুদক্ষ AI কে প্রশ্ন করুন।",
      en: "3. If you need help, ask Sudokkho AI.",
    },
  },
  emptyStates: {
    noJobs: {
      bn: "দুঃখিত, এই মুহূর্তে কোনো সুযোগ পাওয়া যাচ্ছে না। দয়া করে পরে চেষ্টা করুন।",
      en: "Sorry, no opportunities are available right now. Please try again later.",
    },
    noCitations: {
      bn: "এর পক্ষে কোনো সরকারি দলিল পাওয়া যায়নি।",
      en: "No official documents or citations were found to back this up.",
    },
  },
  errorStates: {
    general: {
      bn: "কিছু একটা সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।",
      en: "Something went wrong. Please try again.",
    },
    retry: {
      bn: "আবার চেষ্টা করুন",
      en: "Retry",
    },
  },
};

export function getLocalizedCopy(item: LocalizedString, locale: Locale): string {
  return item[locale] || item.bn;
}
