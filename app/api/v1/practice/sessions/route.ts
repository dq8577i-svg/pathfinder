/**
 * 知径 Pathfinder — POST /api/v1/practice/sessions（M4）
 *
 * 为当前用户创建一个新的费曼练习会话，并生成 AI 开场追问（turn 1）。
 * 不读取任何客户端身份字段；会话绑定 getCurrentUser() 会话用户。
 */
import { NextRequest } from "next/server";
import { err, ok } from "@/lib/api/response";
import { invalidInput } from "@/lib/api/input";
import { getCurrentUser } from "@/lib/auth/require-user";
import { createPracticeSession, PracticeError } from "@/lib/practice/service";
import { createSessionSchema } from "@/lib/practice/input";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return err.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const detail = await createPracticeSession(user.id, parsed.data);
    return ok({ session: detail.session });
  } catch (e) {
    if (e instanceof PracticeError) {
      return err.badRequest(e.code === "NODE_NOT_FOUND" ? "节点不存在" : "无法创建练习会话");
    }
    console.error("[M4] practice/sessions POST", e);
    return err.internal();
  }
}
