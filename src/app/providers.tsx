"use client";

import type { ReactNode } from "react";
import { DemoProvider } from "@/state/demo-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
