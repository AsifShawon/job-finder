"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
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
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
