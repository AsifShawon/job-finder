"use client";

import { DetailActionButtons } from "./detail-action-buttons";

interface MobileStickyBottomBarProps {
  opportunityId: string;
  initialSaved: boolean;
  applyHref: string | null;
  locale: "bn" | "en";
}

export function MobileStickyBottomBar({
  opportunityId,
  initialSaved,
  applyHref,
  locale,
}: MobileStickyBottomBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-card/95 px-4 py-3 backdrop-blur shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
      <DetailActionButtons
        opportunityId={opportunityId}
        initialSaved={initialSaved}
        applyHref={applyHref}
        locale={locale}
        variant="sticky"
      />
    </div>
  );
}
