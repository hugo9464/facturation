import { runCollectiveWorkProspection } from "@/lib/collective-work-prospection";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  if (process.env.NODE_ENV === "development") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handleCron(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await runCollectiveWorkProspection();
  const status = result.errors.length > 0 ? 207 : 200;
  return Response.json(result, { status });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

export async function HEAD() {
  return new Response(null, { status: 405 });
}
