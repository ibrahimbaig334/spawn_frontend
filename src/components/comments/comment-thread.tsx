"use client";

import { useState } from "react";
import { formatDemoUtc, demoTimestamp } from "@/domain/demo-time";
import { selectComments } from "@/domain/selectors";
import { createLocalCommentId } from "@/state/demo-reducer";
import { useDemo } from "@/state/use-demo";
import type { LaunchId } from "@/types/launch";

const MAX_LENGTH = 500;

export function CommentThread({ launchId }: { launchId: LaunchId }) {
  const { state, dispatch } = useDemo();
  const comments = selectComments(state, launchId);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = body.trim();
    if (!value) {
      setError("Write a comment before recording it.");
      return;
    }
    if (value.length > MAX_LENGTH) {
      setError(`Comments are limited to ${MAX_LENGTH} characters.`);
      return;
    }
    const sequence = state.data.sequence + 1;
    dispatch({
      type: "add-comment",
      comment: {
        id: createLocalCommentId(sequence),
        launchId,
        authorProfileId: state.data.portfolio.accountProfileId,
        body: value,
        sequence,
        createdAt: demoTimestamp(sequence),
        source: "local-simulation",
      },
    });
    setBody("");
    setError("");
  }

  return (
    <section
      className="border-t-2 border-ink py-[clamp(2rem,5vw,4rem)]"
      aria-labelledby={`comments-${launchId}`}
    >
      <header className="flex items-end justify-between gap-4 max-[36rem]:items-start max-[36rem]:flex-col">
        <div>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.07em] text-accent-strong uppercase">
            Fictional and browser-local
          </p>
          <h2
            className="mt-1 mb-0 text-[clamp(1.6rem,4vw,2.6rem)]"
            id={`comments-${launchId}`}
          >
            Comments
          </h2>
        </div>
        <span className="font-mono text-xs font-bold text-ink-muted uppercase">
          {comments.length} {comments.length === 1 ? "entry" : "entries"}
        </span>
      </header>
      <form
        className="mt-5 grid gap-2 border border-rule bg-raised p-4 print:hidden"
        onSubmit={submit}
        noValidate
      >
        <label className="font-bold" htmlFor={`comment-${launchId}`}>
          Add a browser-local comment
        </label>
        <textarea
          className="w-full resize-y border border-rule bg-paper p-3 text-ink"
          id={`comment-${launchId}`}
          maxLength={MAX_LENGTH + 1}
          onChange={(event) => {
            setBody(event.target.value);
            if (error) setError("");
          }}
          rows={4}
          value={body}
        />
        <div className="flex items-center justify-between gap-4 max-[36rem]:items-stretch max-[36rem]:flex-col">
          <span className="text-xs text-ink-muted">
            {body.length} / {MAX_LENGTH}
          </span>
          <button
            className="min-h-target cursor-pointer border border-ink bg-ink px-4 py-2 font-bold text-inverse"
            type="submit"
          >
            Record comment
          </button>
        </div>
        <p className="m-0 text-xs text-ink-muted">
          No account, publishing service, likes, replies, or moderation system
          is connected.
        </p>
        {error ? (
          <p className="m-0 text-xs font-bold text-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
      {comments.length ? (
        <ol className="mt-4 mb-0 list-none border-t border-rule p-0">
          {comments.map((comment) => {
            const author =
              state.data.entities.profiles[comment.authorProfileId];
            return (
              <li
                className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-rule py-4"
                key={comment.id}
              >
                <div
                  className="grid size-10 place-items-center border border-ink font-mono text-xs font-bold"
                  aria-hidden="true"
                >
                  {author?.initials ?? "--"}
                </div>
                <div>
                  <p className="m-0 flex justify-between gap-3 max-[36rem]:items-start max-[36rem]:flex-col">
                    <strong>{author?.displayName ?? "Demo participant"}</strong>
                    <span className="font-mono text-[0.65rem] text-ink-muted">
                      {comment.source === "fixture"
                        ? "Fictional fixture"
                        : "Browser-local"}{" "}
                      · {formatDemoUtc(comment.createdAt)}
                    </span>
                  </p>
                  <div className="mt-1.5 overflow-wrap-anywhere whitespace-pre-wrap text-ink-muted">
                    {comment.body}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 border border-rule px-4 py-8 text-center text-ink-muted">
          No comments have been recorded for this demo token.
        </p>
      )}
    </section>
  );
}
