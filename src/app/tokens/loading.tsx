import { StatusPage } from "@/components/ui/status-page";

export default function LoadingTokens() {
  return (
    <StatusPage
      label="Loading directory"
      title="Preparing demo tokens."
      loading
    >
      <p>Fixed fixtures and browser-local launches are being assembled.</p>
    </StatusPage>
  );
}
