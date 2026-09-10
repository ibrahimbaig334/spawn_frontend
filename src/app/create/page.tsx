import type { Metadata } from "next";
import { LaunchConfigurator } from "@/components/launch/launch-configurator";

export const metadata: Metadata = {
  title: "Create a demo launch",
  description:
    "Configure and save a deterministic browser-local Spawn launch. No wallet, contract, or transaction is connected.",
};

export default function CreatePage() {
  return (
    <main id="main-content">
      <LaunchConfigurator />
    </main>
  );
}
