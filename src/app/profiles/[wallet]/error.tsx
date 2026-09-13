"use client";

import { StatusPage } from "@/components/ui/status-page";

export default function ProfileError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StatusPage label="Route error" title="This profile could not load.">
      <p>
        <button className="cursor-pointer font-bold underline" type="button" onClick={reset}>
          Retry
        </button>
      </p>
    </StatusPage>
  );
}
