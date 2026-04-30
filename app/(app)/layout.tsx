import { redirect } from "next/navigation";
import { db } from "@/db";
import { client, profile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const [profileRow] = await db
    .select()
    .from(profile)
    .where(eq(profile.userId, user.id))
    .limit(1);

  if (!profileRow) {
    redirect("/onboarding");
  }

  const clients = await db
    .select()
    .from(client)
    .where(eq(client.userId, user.id))
    .orderBy(client.name);

  return (
    <AppShell email={user.email ?? ""} clients={clients}>
      {children}
    </AppShell>
  );
}
