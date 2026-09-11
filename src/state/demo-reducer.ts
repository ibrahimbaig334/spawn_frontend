import { createSeedState } from "@/data/mock-seed";
import type { DemoAction, DemoState } from "@/types/demo";

const MAX_ACTIVITY = 300;
const MAX_COMMENTS = 300;
const MAX_LEDGER = 500;
const MAX_EVENTS = 500;

function prependBounded(id: string, order: string[], limit: number): string[] {
  return [id, ...order.filter((value) => value !== id)].slice(0, limit);
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "hydrate":
      if (state.runtime.hydration === "ready") return state;
      return {
        data: action.data,
        runtime: {
          ...state.runtime,
          hydration: "ready",
          persistence: "available",
        },
      };
    case "mark-hydrated":
      if (
        state.runtime.hydration === "ready" &&
        state.runtime.persistence === action.persistence
      )
        return state;
      return {
        ...state,
        runtime: {
          ...state.runtime,
          hydration: "ready",
          persistence: action.persistence,
        },
      };
    case "toggle-watch": {
      if (!state.data.entities.launches[action.id]) return state;
      const watchlist = state.data.watchlist.includes(action.id)
        ? state.data.watchlist.filter((id) => id !== action.id)
        : [...state.data.watchlist, action.id];
      return { ...state, data: { ...state.data, watchlist } };
    }
    case "apply-trade": {
      // Trades are dispatched through apply-launch-update by the trade
      // ticket, which composes the full event/activity/ledger payload.
      return state;
    }
    case "add-launch": {
      const { launch, events } = action.result;
      if (state.data.entities.launches[launch.poolId]) return state;
      const activities = { ...state.data.entities.activities };
      const activityOrder = [...state.data.order.activities];
      const activityId = `activity-${launch.poolId}-created-${state.data.sequence + 1}`;
      activities[activityId] = {
        id: activityId,
        launchId: launch.poolId,
        profileId: "profile-local",
        kind: "created",
        sequence: state.data.sequence + 1,
        occurredAt: launch.createdAt,
        source: "local-simulation",
      };
      activityOrder.unshift(activityId);
      return {
        ...state,
        data: {
          ...state.data,
          entities: {
            ...state.data.entities,
            launches: {
              ...state.data.entities.launches,
              [launch.poolId]: launch,
            },
            activities,
          },
          order: {
            ...state.data.order,
            launches: [launch.poolId, ...state.data.order.launches],
            activities: activityOrder.slice(0, MAX_ACTIVITY),
          },
          events: {
            ...state.data.events,
            [launch.poolId]: [
              ...(events ?? []),
              ...(state.data.events[launch.poolId] ?? []),
            ].slice(0, MAX_EVENTS),
          },
          sequence: action.result.nextSequence,
        },
      };
    }
    case "apply-launch-update": {
      const { launch, events, activity, ledger, tokenBalance, ethBalance } =
        action;
      if (!state.data.entities.launches[launch.poolId]) return state;
      const activities = { ...state.data.entities.activities };
      let activityOrder = state.data.order.activities;
      if (activity) {
        activities[activity.id] = activity;
        activityOrder = prependBounded(
          activity.id,
          activityOrder,
          MAX_ACTIVITY,
        );
      }
      const ledgerRecords = { ...state.data.entities.ledger };
      let ledgerOrder = state.data.order.ledger;
      if (ledger) {
        ledgerRecords[ledger.id] = ledger;
        ledgerOrder = prependBounded(ledger.id, ledgerOrder, MAX_LEDGER);
      }
      const tokenBalances = { ...state.data.portfolio.tokenBalances };
      if (tokenBalance !== undefined)
        tokenBalances[launch.poolId] = tokenBalance;
      return {
        ...state,
        data: {
          ...state.data,
          entities: {
            ...state.data.entities,
            launches: {
              ...state.data.entities.launches,
              [launch.poolId]: launch,
            },
            activities,
            ledger: ledgerRecords,
          },
          order: {
            ...state.data.order,
            activities: activityOrder,
            ledger: ledgerOrder,
          },
          events: {
            ...state.data.events,
            [launch.poolId]: [
              ...(events ?? []),
              ...(state.data.events[launch.poolId] ?? []),
            ].slice(0, MAX_EVENTS),
          },
          portfolio: {
            ...state.data.portfolio,
            ethBalance: ethBalance ?? state.data.portfolio.ethBalance,
            tokenBalances,
          },
        },
      };
    }
    case "add-comment": {
      const { comment } = action;
      if (state.data.entities.comments[comment.id]) return state;
      return {
        ...state,
        data: {
          ...state.data,
          entities: {
            ...state.data.entities,
            comments: {
              ...state.data.entities.comments,
              [comment.id]: comment,
            },
          },
          order: {
            ...state.data.order,
            comments: prependBounded(
              comment.id,
              state.data.order.comments,
              MAX_COMMENTS,
            ),
          },
        },
      };
    }
    case "reset":
      return createSeedState();
    default:
      return state;
  }
}
