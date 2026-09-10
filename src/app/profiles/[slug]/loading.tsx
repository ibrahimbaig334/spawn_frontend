import { StatusPage } from "@/components/ui/status-page";

export default function LoadingProfile() {
  return (
    <StatusPage
      label="Loading browser-local data"
      title="Preparing demo profile."
      loading
    >
      <p>
        The route is waiting for fictional fixtures and any profiles saved in
        this browser.
      </p>
    </StatusPage>
  );
}
