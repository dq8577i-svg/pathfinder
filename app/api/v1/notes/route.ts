/**
 * 知径 Pathfinder — GET / POST /api/v1/notes（M6）
 *
 * GET：当前用户全部费曼笔记（按更新时间倒序）。POST：新建一条笔记。
 * 身份唯一来源 HttpOnly 会话；body 不接受 user_id，归属一律会话解析。
 * DB（feynman_notes）为唯一 source of truth。
 */
import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createNoteSchema } from "@/lib/notes/input";
import { createNote, listNotesByUser, NotesError } from "@/lib/notes/service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();
  try {
    const notes = await listNotesByUser(user.id);
    return ok({ notes });
  } catch (e) {
    console.error("[M6] notes GET", e);
    return err.internal();
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const note = await createNote(user.id, parsed.data);
    return ok({ note });
  } catch (e) {
    if (e instanceof NotesError) {
      return e.status === 404
        ? err.badRequest("关联节点不存在")
        : err.internal(e.message);
    }
    console.error("[M6] notes POST", e);
    return err.internal();
  }
}
