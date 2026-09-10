import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PriceHistoryChart } from "@/components/charts/price-history-chart";
import { CommentThread } from "@/components/comments/comment-thread";
import { createSeedState } from "@/data/mock-seed";
import { selectHistory } from "@/domain/selectors";
import { demoReducer } from "@/state/demo-reducer";
import { DemoContext, type DemoContextValue } from "@/state/demo-provider";
import { mockLaunchpadClient } from "@/services/mock-launchpad-client";

describe("token detail components", () => {
  it("exposes chart ranges, keyboard selection, and exact data", async () => {
    const user = userEvent.setup();
    const state = createSeedState();
    const launch = state.data.entities.launches["launch-paloma"]!;
    render(
      <PriceHistoryChart
        launch={launch}
        points={selectHistory(state, launch.id)}
      />,
    );
    const chart = screen.getByRole("img", {
      name: /paloma demo price history/i,
    });
    expect(chart).toHaveAccessibleDescription(/30D history/i);
    chart.focus();
    await user.keyboard("{End}");
    expect(screen.getAllByText(/UTC$/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getAllByText(/All history/i).length).toBeGreaterThan(0);
    await user.click(screen.getByText("View exact history data"));
    expect(
      screen.getByRole("table", { name: /exact demo prices/i }),
    ).toBeInTheDocument();
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
    render(
      <DemoContext value={value}>
        <CommentThread launchId="launch-paloma" />
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
