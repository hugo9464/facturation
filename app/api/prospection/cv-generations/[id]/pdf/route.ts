import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { renderProspectionCvPDFToBuffer } from "@/lib/pdf-render";
import { getSupabaseDb, toProspectionCvGeneration } from "@/lib/supabase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filenameFrom(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await getSupabaseDb();
  const { data, error } = await supabase
    .from("prospection_cv_generation")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return new NextResponse("Not found", { status: 404 });

  const generation = toProspectionCvGeneration(data);
  const buffer = await renderProspectionCvPDFToBuffer({
    cv: generation.generatedCv,
    photoDataUrl: generation.photoDataUrl,
  });
  const disposition =
    new URL(request.url).searchParams.get("download") === "1"
      ? "attachment"
      : "inline";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filenameFrom(generation.title) || "cv-adapte"}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
