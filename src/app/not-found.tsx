import Link from "next/link";
import { StatusPage, STATUS_LINK_CLASS } from "@/components/ui/status-page";

export default function NotFound() {
  return (
    <StatusPage label="404 / Page not found" title="That page does not exist.">
      <p>Browse live markets or launch a token on Spawn.</p>
      <div className="flex gap-4">
        <Link className={STATUS_LINK_CLASS} href="/tokens">
          Browse tokens
        </Link>
        <Link className={STATUS_LINK_CLASS} href="/create">
          Create a launch
        </Link>
      </div>
    </StatusPage>
  );
}
