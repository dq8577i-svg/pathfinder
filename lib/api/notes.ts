/**
 * 知径 Pathfinder — 费曼笔记 API 客户端（M7）
 */
import { api } from "./client";
import type { FeynmanNote } from "@/lib/types";

export async function listNotes(): Promise<FeynmanNote[]> {
  const d = await api<{ notes: FeynmanNote[] }>("/notes");
  return d.notes;
}

export interface NoteInput {
  title: string;
  content: string;
  sessionId?: string;
  nodeId?: string;
  keyTerms?: string[];
  pendingQuestions?: string[];
  selfAssessed?: boolean;
  statusFilter?: FeynmanNote["statusFilter"];
  sourceTag?: FeynmanNote["sourceTag"];
}

export async function createNote(input: NoteInput): Promise<FeynmanNote> {
  const d = await api<{ note: FeynmanNote }>("/notes", { method: "POST", body: input });
  return d.note;
}

export async function updateNote(noteId: string, patch: Partial<NoteInput>): Promise<FeynmanNote> {
  const d = await api<{ note: FeynmanNote }>(`/notes/${encodeURIComponent(noteId)}`, {
    method: "PATCH",
    body: patch,
  });
  return d.note;
}

export async function deleteNote(noteId: string): Promise<void> {
  await api<{ deleted: boolean }>(`/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" });
}
