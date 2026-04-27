import { cookies } from "next/headers";

import bn from "@/messages/bn.json";
import en from "@/messages/en.json";

type Locale = "bn" | "en";
type Messages = typeof bn;
type Namespace = keyof Messages;

const allMessages = { bn, en } as const;

function resolvePath(obj: Record<string, unknown>, path: string): string {
  const result = path.split(".").reduce((cur: unknown, key) => {
    if (cur != null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj as unknown);
  return typeof result === "string" ? result : path;
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "bn";
}

export async function getMessages(): Promise<Messages> {
  const locale = await getLocale();
  return allMessages[locale];
}

export async function getT(namespace: Namespace) {
  const locale = await getLocale();
  const ns = allMessages[locale][namespace] as Record<string, unknown>;

  return (key: string, params?: Record<string, string | number>): string => {
    let str = resolvePath(ns, key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };
}
