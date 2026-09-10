import Link from "next/link";
import { StatusPage, STATUS_LINK_CLASS } from "@/components/ui/status-page";

export default function NotFound() {
  return (
    <StatusPage
      label="404 / Page not found"
      title="That page is not part of this concept."
    >
      <p>
        Return to the Spawn overview to review the demonstration terms and
        risks.
      </p>
      <Link className={STATUS_LINK_CLASS} href="/">
        Return to the overview
      </Link>
    </StatusPage>
  );
}
