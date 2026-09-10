"use client";

import { StatusPage, STATUS_ACTION_CLASS } from "@/components/ui/status-page";

export default function ProfileError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <StatusPage
      label="Profile view unavailable"
      title="The demonstration profile could not be displayed."
    >
      <p>
        No account, wallet, or identity is affected. Retry the browser-local
        view or return to the token directory.
      </p>
      <button className={STATUS_ACTION_CLASS} type="button" onClick={reset}>
        Retry profile view
      </button>
    </StatusPage>
  );
}
