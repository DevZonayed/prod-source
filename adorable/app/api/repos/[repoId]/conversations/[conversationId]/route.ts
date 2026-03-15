import { NextResponse } from "next/server";
import { readConversationMessages } from "@/lib/repo-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string; conversationId: string }> },
) {
  const { repoId, conversationId } = await params;

  const messages = await readConversationMessages(repoId, conversationId);
  return NextResponse.json({ messages });
}
