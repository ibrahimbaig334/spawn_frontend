"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { createSeedState } from "@/data/mock-seed";
import { clearDemoState, loadDemoState, saveDemoState } from "@/lib/storage";
import { mockLaunchpadClient } from "@/services/mock-launchpad-client";
import type { LaunchpadClient } from "@/services/launchpad-client";
import type { DemoAction, DemoState } from "@/types/demo";
import { demoReducer } from "./demo-reducer";

export interface DemoContextValue {
  state: DemoState;
  dispatch: Dispatch<DemoAction>;
  client: LaunchpadClient;
  reset: () => void;
}

export const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within a DemoProvider.");
  return value;
}

export interface DemoProviderProps {
  children: ReactNode;
  client?: LaunchpadClient;
  initialState?: DemoState;
}

export function DemoProvider({
  children,
  client = mockLaunchpadClient,
  initialState,
}: DemoProviderProps) {
  const [state, dispatch] = useReducer(
    demoReducer,
    initialState ?? createSeedState(),
  );

  useEffect(() => {
    const stored = loadDemoState();
    dispatch(
      stored
        ? { type: "hydrate", data: stored }
        : {
            type: "mark-hydrated",
            persistence:
              typeof window !== "undefined" && "localStorage" in window
                ? "available"
                : "unavailable",
          },
    );
  }, []);

  useEffect(() => {
    if (state.runtime.hydration === "ready") saveDemoState(state.data);
  }, [state.data, state.runtime.hydration]);

  const value = useMemo<DemoContextValue>(
    () => ({
      state,
      dispatch,
      client,
      reset: () => {
        clearDemoState();
        dispatch({ type: "reset" });
      },
    }),
    [client, state],
  );

  return <DemoContext value={value}>{children}</DemoContext>;
}
