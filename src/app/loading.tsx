import { StatusPage } from "@/components/ui/status-page";

export default function Loading() {
  return (
    <StatusPage label="Spawn" title="Loading" loading busy>
      <p role="status">Preparing the page…</p>
    </StatusPage>
  );
}
