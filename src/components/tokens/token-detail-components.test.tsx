import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { CommentThread } from "@/components/comments/comment-thread";
import { createSeedState } from "@/data/mock-seed";
import { selectLaunches, selectLedger } from "@/domain/selectors";
import { demoReducer } from "@/state/demo-reducer";
import { DemoContext, type DemoContextValue } from "@/state/demo-provider";
import { mockLaunchpadClient } from "@/services/mock-launchpad-client";

describe("token detail components", () => {
  it("charts level-derived prices from the ledger", async () => {
    const user = userEvent.setup();
    const state = createSeedState();
    const launch = selectLaunches(state)[0]!;
    const points = selectLedger(state, launch.poolId);
    render(<PriceHistoryChart launch={launch} points={points} />);
    if (points.length) {
      const chart = screen.getByRole("img");
      expect(chart).toBeInTheDocument();
      const point = screen.getAllByRole("button", { name: /level/i })[0]!;
      await user.click(point);
      expect(screen.getAllByText(/^level$/i).length).toBeGreaterThan(0);
    } else {
      expect(
        screen.getByText(/no recorded trades yet/i),
      ).toBeInTheDocument();
    }
  });

  it("validates and dispatches a deterministic browser-local comment", async () => {
    const user = userEvent.setup();
    const state = demoReducer(createSeedState(), {
      type: "mark-hydrated",
      persistence: "available",
    });
    const dispatch = vi.fn();
    const value: DemoContextValue = {
      state,
      dispatch,
      client: mockLaunchpadClient,
      reset: vi.fn(),
    };
    const launchId = state.data.order.launches[0]!;
    render(
      <DemoContext value={value}>
        <CommentThread launchId={launchId} />
      </DemoContext>,
    );
    await user.click(screen.getByRole("button", { name: /record comment/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/write a comment/i);
    await user.type(
      screen.getByLabelText(/add a browser-local comment/i),
      "Clear published terms make this easy to inspect.",
    );
    await user.click(screen.getByRole("button", { name: /record comment/i }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "add-comment",
        comment: expect.objectContaining({
          body: "Clear published terms make this easy to inspect.",
          source: "local-simulation",
        }),
      }),
    );
  });
});
