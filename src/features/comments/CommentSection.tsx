import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AttachmentTray,
  ExpandableText,
  MediaGallery,
} from "../../components/media";
import { MoreMenu } from "../../components/MoreMenu";
import { Avatar, Icon, Loading, ProfileLink } from "../../components/ui";
import { COMMENT_COPY } from "../../config/copy";
import { useAuth } from "../../lib/auth-context";
import { formatRelativeTime } from "../../lib/format";
import {
  asMediaList,
  removePublicMedia,
  uploadPublicMediaList,
  validateFile,
  type MediaItem,
} from "../../lib/media";
import {
  fetchProfileCards,
  UNKNOWN_NICKNAME,
  type ProfileCard,
} from "../../lib/profiles";
import { supabase } from "../../lib/supabase";
import "./CommentSection.css";

export type CommentRow = {
  id: number;
  body: string;
  media: MediaItem[];
  author_id: string | null;
  parent_id: number | null;
  created_at: string;
  edited_at: string | null;
};

const COLUMNS = "id, body, media, author_id, parent_id, created_at, edited_at";
const MAX_COMMENT_IMAGES = 4;

type Props = {
  table: "comments" | "bungae_comments";
  parentColumn: "post_id" | "bungae_id";
  targetId: number;
  reportType: "comment" | "bungae_comment";
  canWrite: boolean;
  // 글을 쓸 수 없을 때 하단 바에 대신 보여줄 것(로그인 버튼, 참석 신청 버튼 등)
  writeBlocked?: ReactNode;
  placeholder?: string;
  title?: string;
  onCountChange?: (delta: number) => void;
};

type ReplyTarget = { rootId: number; nickname: string; mention: boolean };

export function CommentSection({
  table,
  parentColumn,
  targetId,
  reportType,
  canWrite,
  writeBlocked,
  placeholder,
  title = COMMENT_COPY.title,
  onCountChange,
}: Props) {
  const { profile, blockedIds } = useAuth();
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [cards, setCards] = useState<Record<string, ProfileCard>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from(table)
      .select(COLUMNS)
      .eq(parentColumn, targetId)
      .eq("status", "visible")
      .order("created_at", { ascending: true });
    const list = ((data ?? []) as CommentRow[]).map((r) => ({
      ...r,
      media: asMediaList(r.media),
    }));
    setRows(list);
    setCards(await fetchProfileCards(list.map((r) => r.author_id)));
    setLoading(false);
  }, [table, parentColumn, targetId]);

  useEffect(() => {
    load();
  }, [load]);

  // 대댓글은 항상 최상위 댓글 아래에 모아요(답글의 답글은 @닉네임으로 표시).
  const threads = useMemo(() => {
    const visible = rows.filter(
      (r) => !r.author_id || !blockedIds.has(r.author_id),
    );
    const byId = new Map(visible.map((r) => [r.id, r]));
    const rootOf = (r: CommentRow): number => {
      let cur = r;
      const seen = new Set<number>();
      while (cur.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parent_id)!;
      }
      return cur.id;
    };
    const roots: CommentRow[] = [];
    const children = new Map<number, CommentRow[]>();
    for (const r of visible) {
      const root = rootOf(r);
      if (root === r.id) roots.push(r);
      else children.set(root, [...(children.get(root) ?? []), r]);
    }
    return roots.map((root) => ({
      root,
      replies: children.get(root.id) ?? [],
    }));
  }, [rows, blockedIds]);

  const total = threads.reduce((n, t) => n + 1 + t.replies.length, 0);
  const nick = (id: string | null) =>
    (id && cards[id]?.nickname) || UNKNOWN_NICKNAME;

  function startReply(comment: CommentRow, rootId: number) {
    setReplyTo({
      rootId,
      nickname: nick(comment.author_id),
      mention: comment.id !== rootId,
    });
    inputRef.current?.focus();
  }

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/"));
    const invalid = picked.map((f) => validateFile(f)).find(Boolean);
    if (invalid) setError(invalid);
    const ok = picked.filter((f) => !validateFile(f));
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_COMMENT_IMAGES));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!profile || sending) return;
    const text = draft.trim();
    if (!text && files.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const media = await uploadPublicMediaList(profile.id, files);
      const body =
        replyTo?.mention && text ? `@${replyTo.nickname} ${text}` : text;
      const { data, error: insertError } = await supabase
        .from(table)
        .insert({
          [parentColumn]: targetId,
          author_id: profile.id,
          parent_id: replyTo?.rootId ?? null,
          body,
          media,
        })
        .select(COLUMNS)
        .single();
      if (insertError || !data) {
        await removePublicMedia(media);
        throw new Error(COMMENT_COPY.submitError);
      }
      setRows((prev) => [
        ...prev,
        { ...(data as CommentRow), media: asMediaList(data.media) },
      ]);
      setCards((prev) => ({
        ...prev,
        [profile.id]: { ...prev[profile.id], ...selfCard(profile) },
      }));
      setDraft("");
      setFiles([]);
      setReplyTo(null);
      onCountChange?.(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : COMMENT_COPY.submitError);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(comment: CommentRow, body: string) {
    const { data, error: updateError } = await supabase
      .from(table)
      .update({ body })
      .eq("id", comment.id)
      .select(COLUMNS)
      .single();
    if (updateError || !data) {
      setError(COMMENT_COPY.editError);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === comment.id
          ? { ...(data as CommentRow), media: asMediaList(data.media) }
          : r,
      ),
    );
    setEditingId(null);
  }

  async function remove(comment: CommentRow) {
    const removed = rows.filter(
      (r) => r.id === comment.id || r.parent_id === comment.id,
    );
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("id", comment.id);
    if (deleteError) {
      setError(COMMENT_COPY.deleteError);
      return;
    }
    const removedIds = new Set(removed.map((r) => r.id));
    setRows((prev) => prev.filter((r) => !removedIds.has(r.id)));
    void removePublicMedia(removed.flatMap((r) => r.media));
    onCountChange?.(-removed.length);
  }

  function renderComment(c: CommentRow, rootId: number, isReply: boolean) {
    const card = c.author_id ? cards[c.author_id] : undefined;
    const name = nick(c.author_id);
    const isMine = !!profile && c.author_id === profile.id;
    return (
      <div
        className={`comment${isReply ? " comment--reply" : ""}`}
        data-testid="comment"
      >
        <ProfileLink
          userId={c.author_id}
          className="comment__avatar"
          label={name}
        >
          <Avatar
            name={name}
            seed={c.author_id}
            src={card?.avatar_url}
            size={isReply ? "xs" : "sm"}
          />
        </ProfileLink>
        <div className="comment__main">
          <div className="comment__head">
            <ProfileLink userId={c.author_id} className="comment__name">
              {name}
            </ProfileLink>
            <span className="comment__time">
              {formatRelativeTime(c.created_at)}
              {c.edited_at && ` · ${COMMENT_COPY.edited}`}
            </span>
            <MoreMenu
              className="comment__more"
              isMine={isMine}
              authorId={c.author_id}
              authorName={name}
              report={{ type: reportType, id: c.id }}
              onEdit={() => setEditingId(c.id)}
              onDelete={() => remove(c)}
              deleteConfirm={COMMENT_COPY.deleteConfirm}
            />
          </div>
          {editingId === c.id ? (
            <EditBox
              initial={c.body}
              onCancel={() => setEditingId(null)}
              onSave={(body) => saveEdit(c, body)}
            />
          ) : (
            <>
              <ExpandableText text={c.body} className="comment__body" />
              <MediaGallery items={c.media} compact />
            </>
          )}
          {canWrite && editingId !== c.id && (
            <button
              type="button"
              className="comment__reply"
              onClick={() => startReply(c, rootId)}
            >
              {COMMENT_COPY.reply}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="comments">
      <div className="comments__head">
        <span>{title}</span>
        <span className="muted">{total}</span>
      </div>

      {loading ? (
        <Loading />
      ) : threads.length === 0 ? (
        <p className="comments__empty">{COMMENT_COPY.empty}</p>
      ) : (
        <ul className="comment-list">
          {threads.map(({ root, replies }) => (
            <li key={root.id} className="comment-thread">
              {renderComment(root, root.id, false)}
              {replies.length > 0 && (
                <ul className="comment-replies">
                  {replies.map((r) => (
                    <li key={r.id}>{renderComment(r, root.id, true)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 글래스 카드(backdrop-filter) 안에서는 position: fixed가 카드 기준이 돼서, 하단 바는 body로 옮겨 그려요. */}
      {createPortal(
        <div className="bottom-bar">
          {canWrite && profile ? (
            <div className="comment-composer">
              {replyTo && (
                <div className="comment-composer__reply">
                  <Icon name="reply-icon" />
                  <span>{COMMENT_COPY.replyingTo(replyTo.nickname)}</span>
                  <button type="button" onClick={() => setReplyTo(null)}>
                    {COMMENT_COPY.cancelReply}
                  </button>
                </div>
              )}
              <AttachmentTray
                files={files}
                onRemove={(i) =>
                  setFiles((prev) => prev.filter((_, idx) => idx !== i))
                }
              />
              {error && (
                <p className="error-text comment-composer__error">{error}</p>
              )}
              <form
                className="composer-bar comment-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <Avatar
                  name={profile.nickname}
                  seed={profile.id}
                  src={profile.avatar_url}
                  size="sm"
                />
                <textarea
                  ref={inputRef}
                  rows={1}
                  placeholder={placeholder ?? COMMENT_COPY.placeholder}
                  aria-label={COMMENT_COPY.placeholder}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={COMMENT_COPY.attachImage}
                  disabled={files.length >= MAX_COMMENT_IMAGES}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon name="image-icon" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => pickFiles(e.target.files)}
                />
                <button
                  type="submit"
                  className="circle-button circle-button--primary circle-button--sm"
                  disabled={(!draft.trim() && files.length === 0) || sending}
                  aria-label={COMMENT_COPY.submit}
                >
                  <Icon name="arrow-up-icon" />
                </button>
              </form>
            </div>
          ) : (
            writeBlocked
          )}
        </div>,
        document.body,
      )}
    </section>
  );
}

function selfCard(p: {
  id: string;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  work_type: string | null;
  show_work_badge: boolean;
}): ProfileCard {
  return {
    id: p.id,
    nickname: p.nickname,
    avatar_url: p.avatar_url,
    bio: p.bio,
    work_type: p.work_type,
    show_work_badge: p.show_work_badge,
  };
}

export function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (body: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="comment-edit">
      <textarea
        className="field-textarea"
        value={value}
        rows={3}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="comment-edit__actions">
        <button
          type="button"
          className="pill-button-ghost pill-button-ghost--sm"
          onClick={onCancel}
        >
          {COMMENT_COPY.cancel}
        </button>
        <button
          type="button"
          className="pill-button pill-button--sm"
          disabled={!value.trim() || value.trim() === initial.trim()}
          onClick={() => onSave(value.trim())}
        >
          {COMMENT_COPY.save}
        </button>
      </div>
    </div>
  );
}
