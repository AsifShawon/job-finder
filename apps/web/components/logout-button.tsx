"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const locale = useLocale();
  const isEn = locale === "en";
  const [pending, setPending] = useState(false);

  const logout = async () => {
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={logout} disabled={pending}>
      {pending ? (isEn ? "Signing out..." : "প্রস্থান করা হচ্ছে...") : (isEn ? "Sign out" : "প্রস্থান")}
    </Button>
  );
}
