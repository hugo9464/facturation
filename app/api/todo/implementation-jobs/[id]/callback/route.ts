import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { toTodoImplementationJob } from "@/lib/supabase/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { todoImplementationJobStatusEnum } from "@/db/schema";
import {
  getImplementationCallbackSecret,
  implementationCallbackTokenFor,
} from "@/lib/hermes-automation";

const callbackSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(todoImplementationJobStatusEnum.enumValues),
  branchName: z.string().trim().optional().nullable(),
  prUrl: z.string().trim().url().optional().nullable(),
  previewUrl: z.string().trim().url().optional().nullable(),
  logs: z.string().max(20_000).optional().nullable(),
  errorMessage: z.string().max(4_000).optional().nullable(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const secret = getImplementationCallbackSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Callback secret not configured" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = callbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const expectedToken = implementationCallbackTokenFor(
    jobId,
    parsed.data.taskId,
    secret,
  );
  if (token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: jobRow, error: jobError } = await supabase
    .from("todo_implementation_job")
    .select("*")
    .eq("id", jobId)
    .eq("task_id", parsed.data.taskId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!jobRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const job = toTodoImplementationJob(jobRow);
  const update = {
    status: parsed.data.status,
    branch_name: parsed.data.branchName ?? job.branchName,
    pr_url: parsed.data.prUrl ?? job.prUrl,
    preview_url: parsed.data.previewUrl ?? job.previewUrl,
    logs: parsed.data.logs ?? job.logs,
    error_message: parsed.data.errorMessage ?? job.errorMessage,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("todo_implementation_job")
    .update(update)
    .eq("id", jobId);
  if (updateError) throw updateError;

  const taskUpdate: Record<string, string> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.prUrl) taskUpdate.pr_url = parsed.data.prUrl;
  if (parsed.data.previewUrl) taskUpdate.preview_url = parsed.data.previewUrl;
  if (parsed.data.status === "SUCCEEDED") taskUpdate.status = "TO_TEST";

  if (Object.keys(taskUpdate).length > 1 || parsed.data.status === "SUCCEEDED") {
    const { error: taskError } = await supabase
      .from("todo_task")
      .update(taskUpdate)
      .eq("id", parsed.data.taskId);
    if (taskError) throw taskError;
  }

  revalidatePath("/todo");
  revalidatePath(`/projects/${job.projectId}`);
  return NextResponse.json({ ok: true });
}
