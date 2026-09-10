import { createSeedData } from "@/data/mock-seed";
import { demoTimestamp } from "@/domain/demo-time";
import type { DemoAction, DemoState } from "@/types/demo";

const MAX_ACTIVITY = 300;
const MAX_HISTORY = 600;
const MAX_COMMENTS = 300;
const MAX_LEDGER = 500;

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
      const { result } = action;
      if (
        !state.data.entities.launches[result.launch.id] ||
        result.nextSequence <= state.data.sequence
      )
        return state;
      const activities = { ...state.data.entities.activities };
      let activityOrder = state.data.order.activities;
      for (const activity of result.activities) {
        activities[activity.id] = activity;
        activityOrder = prependBounded(
          activity.id,
          activityOrder,
          MAX_ACTIVITY,
        );
      }
      return {
        ...state,
        data: {
          ...state.data,
          entities: {
            ...state.data.entities,
            launches: {
              ...state.data.entities.launches,
              [result.launch.id]: result.launch,
            },
            activities,
            history: {
              ...state.data.entities.history,
              [result.historyPoint.id]: result.historyPoint,
            },
            ledger: {
              ...state.data.entities.ledger,
              [result.ledgerEntry.id]: result.ledgerEntry,
            },
          },
          order: {
            ...state.data.order,
            activities: activityOrder,
            history: prependBounded(
              result.historyPoint.id,
              state.data.order.history,
              MAX_HISTORY,
            ),
            ledger: prependBounded(
              result.ledgerEntry.id,
              state.data.order.ledger,
              MAX_LEDGER,
            ),
          },
          portfolio: { ...state.data.portfolio, ethBalance: result.ethBalance },
          sequence: result.nextSequence,
        },
      };
    }
    case "add-launch": {
      const { result } = action;
      if (
        state.data.entities.launches[result.launch.id] ||
        result.nextSequence <= state.data.sequence
      )
        return state;
      const profiles = result.profile
        ? {
            ...state.data.entities.profiles,
            [result.profile.id]: result.profile,
          }
        : state.data.entities.profiles;
      const profileOrder = result.profile
        ? prependBounded(
            result.profile.id,
            state.data.order.profiles,
            Number.MAX_SAFE_INTEGER,
          )
        : state.data.order.profiles;
      return {
        ...state,
        data: {
          ...state.data,
          entities: {
            ...state.data.entities,
            launches: {
              ...state.data.entities.launches,
              [result.launch.id]: result.launch,
            },
            profiles,
            activities: {
              ...state.data.entities.activities,
              [result.activity.id]: result.activity,
            },
            history: {
              ...state.data.entities.history,
              [result.historyPoint.id]: result.historyPoint,
            },
          },
          order: {
            ...state.data.order,
            launches: [result.launch.id, ...state.data.order.launches],
            profiles: profileOrder,
            activities: prependBounded(
              result.activity.id,
              state.data.order.activities,
              MAX_ACTIVITY,
            ),
            history: prependBounded(
              result.historyPoint.id,
              state.data.order.history,
              MAX_HISTORY,
            ),
          },
          sequence: result.nextSequence,
        },
      };
    }
    case "add-comment": {
      const { comment } = action;
      if (
        state.data.entities.comments[comment.id] ||
        !state.data.entities.launches[comment.launchId]
      )
        return state;
      if (
        !state.data.entities.profiles[comment.authorProfileId] ||
        comment.sequence <= state.data.sequence
      )
        return state;
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
          sequence: comment.sequence,
        },
      };
    }
    case "reset":
      return {
        data: createSeedData(),
        runtime: { hydration: "ready", persistence: state.runtime.persistence },
      };
  }
}

export function createLocalCommentId(sequence: number): string {
  return `comment-local-${sequence}-${demoTimestamp(sequence).slice(0, 10)}`;
}
