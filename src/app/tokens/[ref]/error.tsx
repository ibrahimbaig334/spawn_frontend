"use client";

import { StatusPage } from "@/components/ui/status-page";

export default function TokenError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusPage label="Route error" title="This token page could not load.">
      <p>
        <button className="cursor-pointer font-bold underline" type="button" onClick={reset}>
          Retry
        </button>
      </p>
    </StatusPage>
  );
}
