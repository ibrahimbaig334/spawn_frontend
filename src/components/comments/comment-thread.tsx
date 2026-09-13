"use client";

import { useState } from "react";
import { useComments, useCommentReplies, useCreateComment, useDeleteComment, useCommentLike } from "@/lib/queries";
import { ApiError } from "@/lib/api/client";
import type { CommentItem } from "@/lib/api/dto";
import { useWallet } from "@/lib/chain/wallet";
import { Button, StatusMessage, StatusRegion, TextareaField } from "@/components/ui";
import { truncateAddress } from "@/services/ipfs-client";
import { relativeTime } from "@/lib/display";

const MAX_TEXT = 2000;

function authorLabel(comment: CommentItem): string {
  return comment.author?.username ? `@${comment.author.username}` : truncateAddress(comment.walletAddress);
}

function LikeButton({ comment, tokenRef }: { comment: CommentItem; tokenRef: string }) {
  const wallet = useWallet();
  const like = useCommentLike(tokenRef);
  const [error, setError] = useState<string | null>(null);
  const likedByMe = like.variables?.commentId === comment.id ? like.variables.liked : undefined;
  const isLiked = likedByMe ?? false;
  return (
    <button
      type="button"
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-rule bg-transparent px-2 text-xs font-bold text-ink-muted hover:border-ink hover:text-ink"
      onClick={() => {
        if (!wallet.address) return setError("Connect a wallet to like comments.");
        setError(null);
        like.mutate({ commentId: comment.id, walletAddress: wallet.address, liked: !isLiked });
      }}
    >
      ♥ {comment.likeCount}
      {error ? <span className="text-error">{error}</span> : null}
    </button>
  );
}

function CommentNode({
  comment,
  tokenRef,
  isRoot = true,
}: {
  comment: CommentItem;
  tokenRef: string;
  isRoot?: boolean;
}) {
  const wallet = useWallet();
  const deleteComment = useDeleteComment(tokenRef);
  const [replying, setReplying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const createReply = useCreateComment(tokenRef);
  const mine = Boolean(wallet.address && wallet.address.toLowerCase() === comment.walletAddress.toLowerCase());
  const wantsAllReplies = expanded || replying;
  const repliesQuery = useCommentReplies(comment.id, wantsAllReplies && comment.replyCount > 0);
  const expandedReplies = wantsAllReplies
    ? repliesQuery.data?.data ?? comment.replies
    : comment.replies?.slice(0, 3);

  const submitReply = () => {
    if (!wallet.address) {
      setReplyError("Connect a wallet first.");
      return;
    }
    if (replyText.trim().length < 1) return;
    createReply.mutate(
      { walletAddress: wallet.address, text: replyText.trim(), parentCommentId: comment.id },
      {
        onSuccess: () => {
          setReplyText("");
          setReplying(false);
          setReplyError(null);
        },
        onError: (error) => setReplyError((error as Error).message),
      },
    );
  };

  return (
    <li className="grid gap-2 border-b border-rule py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <a className="font-bold text-ink no-underline hover:underline" href={`/profiles/${comment.walletAddress}`}>
          {authorLabel(comment)}
        </a>
        <span className="text-ink-muted">{relativeTime(comment.createdAt)}</span>
        <span className="ml-auto flex items-center gap-2">
          <LikeButton comment={comment} tokenRef={tokenRef} />
          {isRoot && comment.depth < 3 ? (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-xs font-bold text-ink-muted underline-offset-2 hover:underline"
              onClick={() => {
                setReplying((current) => !current);
                setExpanded(true);
              }}
            >
              Reply
            </button>
          ) : null}
          {mine && !comment.isDeleted ? (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-xs font-bold text-error underline-offset-2 hover:underline"
              disabled={deleteComment.isPending}
              onClick={() => {
                if (!wallet.address) return;
                deleteComment.mutate({ commentId: comment.id, walletAddress: wallet.address });
              }}
            >
              Delete
            </button>
          ) : null}
        </span>
      </div>
      {comment.isDeleted ? (
        <p className="m-0 text-sm text-ink-muted italic">This comment was removed by its author.</p>
      ) : (
        <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed text-ink">{comment.text}</p>
      )}
      {replying ? (
        <div className="grid gap-2">
          <textarea
            aria-label="Reply text"
            className="min-h-20 w-full resize-y rounded-sm border-2 border-ink-muted bg-raised p-3 text-sm text-ink"
            maxLength={MAX_TEXT}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={`Reply to ${authorLabel(comment)}…`}
          />
          {replyError ? <StatusMessage tone="error">{replyError}</StatusMessage> : null}
          <div className="flex gap-2">
            <Button onClick={submitReply} disabled={createReply.isPending}>
              {createReply.isPending ? "Posting…" : "Post reply"}
            </Button>
            <Button variant="quiet" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {comment.replyCount > 0 ? (
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent text-left text-xs font-bold text-accent-strong hover:underline"
          onClick={() => setExpanded((current) => !current)}
        >
          {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"} — {expanded ? "collapse" : "show all"}
        </button>
      ) : null}
      {expandedReplies && expandedReplies.length > 0 ? (
        <ul className="ml-6 grid list-none gap-1 border-l-2 border-rule pl-4">
          {expandedReplies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} tokenRef={tokenRef} isRoot={false} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CommentThread({ tokenRef }: { tokenRef: string }) {
  const wallet = useWallet();
  const [sort, setSort] = useState<"newest" | "top" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const comments = useComments(tokenRef, { sort, page });
  const createComment = useCreateComment(tokenRef);

  const submit = () => {
    if (!wallet.address) {
      setError("Connect a wallet to join the discussion.");
      return;
    }
    const trimmed = text.trim();
    if (trimmed.length < 1 || trimmed.length > MAX_TEXT) {
      setError("Comments are 1–2000 characters.");
      return;
    }
    setError(null);
    createComment.mutate(
      { walletAddress: wallet.address, text: trimmed },
      {
        onSuccess: () => setText(""),
        onError: (cause) => {
          const apiError = cause as ApiError;
          if (apiError.code === "RATE_LIMITED") {
            setError(`Rate limited — retry after ${apiError.retryAfterSeconds ?? 30}s.`);
          } else {
            setError(apiError.message);
          }
        },
      },
    );
  };

  const totalPages = comments.data?.meta.totalPages ?? 1;

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["newest", "top", "oldest"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={sort === option}
            className={[
              "min-h-8 cursor-pointer rounded-sm border px-3 py-1 text-xs font-bold capitalize",
              sort === option ? "border-ink bg-ink text-inverse" : "border-rule text-ink-muted",
            ].join(" ")}
            onClick={() => {
              setSort(option);
              setPage(1);
            }}
          >
            {option}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-ink-muted">
          {comments.data?.meta.total ?? 0} comments
        </span>
      </div>

      <div className="grid gap-2">
        <TextareaField
          id="new-comment"
          label={wallet.address ? `Comment as ${truncateAddress(wallet.address)}` : "Comment (wallet required)"}
          value={text}
          maxLength={MAX_TEXT}
          onChange={(event) => setText(event.target.value)}
          placeholder="Share research, not financial advice."
        />
        <StatusRegion>
          {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
        </StatusRegion>
        <div className="flex items-center justify-end gap-2">
          <span className="font-mono text-[0.68rem] text-ink-muted">{text.length}/{MAX_TEXT}</span>
          <Button onClick={submit} disabled={createComment.isPending || text.trim().length === 0}>
            {createComment.isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>

      {comments.isLoading ? (
        <p className="py-6 text-center text-sm text-ink-muted">Loading comments…</p>
      ) : comments.data && comments.data.data.length > 0 ? (
        <ul className="m-0 list-none border-t border-rule p-0">
          {comments.data.data.map((comment) => (
            <CommentNode key={comment.id} comment={comment} tokenRef={tokenRef} />
          ))}
        </ul>
      ) : (
        <p className="border border-rule bg-raised p-6 text-center text-sm text-ink-muted">
          No comments yet — start the discussion.
        </p>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="font-mono text-xs text-ink-muted">
            {page} / {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
