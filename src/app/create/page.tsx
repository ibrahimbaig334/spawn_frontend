import type { Metadata } from "next";
import { LaunchConfigurator } from "@/components/launch/launch-configurator";

export const metadata: Metadata = {
  title: "Launch a token",
  description:
    "Prepare, predict and launch a Spawn token — relayed by the protocol operator or sent directly from your wallet.",
};

export default function CreatePage() {
  return (
    <main id="main-content">
      <LaunchConfigurator />
    </main>
  );
}
