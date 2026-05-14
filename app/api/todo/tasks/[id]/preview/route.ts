import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyPreviewToken } from "@/lib/todo-preview";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  previewUrl: z.string().url("URL de preview invalide").max(2048),
  prUrl: z.string().url("URL de PR invalide").max(2048).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  if (!token || !verifyPreviewToken(id, token)) {
    return NextResponse.json({ error: "Jeton invalide" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("todo_task")
    .update({
      preview_url: parsed.data.previewUrl,
      pr_url: parsed.data.prUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });
  }

  revalidatePath("/todo");
  revalidatePath("/projects/[id]", "page");

  return NextResponse.json({
    ok: true,
    taskId: id,
    previewUrl: parsed.data.previewUrl,
    prUrl: parsed.data.prUrl ?? null,
  });
}
