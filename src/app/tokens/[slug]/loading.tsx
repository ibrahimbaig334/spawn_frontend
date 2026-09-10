import { StatusPage } from "@/components/ui/status-page";

export default function LoadingToken() {
  return (
    <StatusPage
      label="Loading browser-local data"
      title="Preparing token details."
      loading
    >
      <p>
        The route is waiting for fixed fixtures and any launches saved in this
        browser.
      </p>
    </StatusPage>
  );
}
