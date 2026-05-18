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
import { shouldMoveTaskToValidationAfterCallback } from "@/lib/todo-implementation-workflow";
import { buildPreviewAccessUrlFromEnv } from "@/lib/preview-access";

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
  const storedPreviewUrl = buildPreviewAccessUrlFromEnv(parsed.data.previewUrl);
  const update = {
    status: parsed.data.status,
    branch_name: parsed.data.branchName ?? job.branchName,
    pr_url: parsed.data.prUrl ?? job.prUrl,
    preview_url: storedPreviewUrl ?? job.previewUrl,
    logs: parsed.data.logs ?? job.logs,
    error_message: parsed.data.errorMessage ?? job.errorMessage,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("todo_implementation_job")
    .update(update)
    .eq("id", jobId);
  if (updateError) throw updateError;

  const taskUpdate: Record<string, string | number> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.prUrl) taskUpdate.pr_url = parsed.data.prUrl;
  if (storedPreviewUrl) taskUpdate.preview_url = storedPreviewUrl;
  const shouldMoveToValidation = shouldMoveTaskToValidationAfterCallback({
    jobAgent: job.agent,
    callbackStatus: parsed.data.status,
  });
  if (shouldMoveToValidation) {
    const { data: lastTaskRows, error: orderError } = await supabase
      .from("todo_task")
      .select("order")
      .eq("user_id", job.userId)
      .eq("project_id", job.projectId)
      .eq("status", "TO_TEST")
      .order("order", { ascending: false })
      .limit(1);
    if (orderError) throw orderError;
    taskUpdate.status = "TO_TEST";
    taskUpdate.order = ((lastTaskRows?.[0]?.order as number | undefined) ?? -1) + 1;
    taskUpdate.completed_at = new Date().toISOString();
  }

  if (Object.keys(taskUpdate).length > 1 || shouldMoveToValidation) {
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
