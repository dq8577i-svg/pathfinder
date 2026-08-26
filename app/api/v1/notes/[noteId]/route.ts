/**
 * 知径 Pathfinder — GET / PATCH / DELETE /api/v1/notes/:noteId（M6）
 *
 * 只允许当前用户操作自己的笔记：SQL 层 id + user_id 双条件，
 * 未命中 / 非本人统一 404（不泄露笔记是否存在）。
 * PATCH 支持 title/content/keyTerms/pendingQuestions/selfAssessed/
 * statusFilter/sourceTag/nodeId；nodeId 可置 null 清空。
 */
import { NextRequest } from "next/server";
import { err, fail, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { patchNoteSchema } from "@/lib/notes/input";
import { deleteNote, getNoteForUser, NotesError, updateNote } from "@/lib/notes/service";

type Ctx = { params: Promise<{ noteId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { noteId } = await params;
  try {
    const note = await getNoteForUser(noteId, user.id);
    if (!note) return failNoteNotFound();
    return ok({ note });
  } catch (e) {
    console.error("[M6] notes/:noteId GET", e);
    return err.internal();
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { noteId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchNoteSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const note = await updateNote(noteId, user.id, parsed.data);
    if (!note) return failNoteNotFound();
    return ok({ note });
  } catch (e) {
    if (e instanceof NotesError) {
      return e.status === 404 ? err.badRequest("关联节点不存在") : err.internal(e.message);
    }
    console.error("[M6] notes/:noteId PATCH", e);
    return err.internal();
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  const { noteId } = await params;
  try {
    const deleted = await deleteNote(noteId, user.id);
    if (!deleted) return failNoteNotFound();
    return ok({ deleted: true });
  } catch (e) {
    console.error("[M6] notes/:noteId DELETE", e);
    return err.internal();
  }
}

/** 他人 / 不存在统一 404（不泄露） */
function failNoteNotFound() {
  return fail("NOTE_NOT_FOUND", "笔记不存在", { status: 404 });
}
