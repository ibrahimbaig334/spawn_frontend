"use client";

import { StatusPage, STATUS_ACTION_CLASS } from "@/components/ui/status-page";

export default function TokenError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <StatusPage
      label="Token view unavailable"
      title="The demonstration could not be displayed."
    >
      <p>
        No wallet or transaction is affected. Retry the browser-local view or
        return to the token directory.
      </p>
      <button className={STATUS_ACTION_CLASS} type="button" onClick={reset}>
        Retry token view
      </button>
    </StatusPage>
  );
}
