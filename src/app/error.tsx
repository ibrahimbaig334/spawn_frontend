"use client";

import { useEffect } from "react";
import { StatusPage, STATUS_ACTION_CLASS } from "@/components/ui/status-page";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      label="Something interrupted the page"
      title="This view could not be loaded."
    >
      <p>No transaction was started. Try rendering the page again.</p>
      <button className={STATUS_ACTION_CLASS} type="button" onClick={reset}>
        Try again
      </button>
    </StatusPage>
  );
}
