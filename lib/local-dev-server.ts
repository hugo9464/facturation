import { headers } from "next/headers";
import { isLocalhostHostHeader } from "@/lib/local-dev-auth";

export async function isLocalhostServerRequest() {
  const headersList = await headers();
  return isLocalhostHostHeader(
    headersList.get("host") ?? headersList.get("x-forwarded-host"),
  );
}
