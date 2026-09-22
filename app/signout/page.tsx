import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession, SESSION_COOKIE } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (url.pathname === "/signin" || url.pathname === "/signout" || url.pathname === "/callback")
    return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const returnTo = safeRelativeReturnPath((await searchParams).return_to || "/");
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySession(token);
    try {
      cookieStore.delete(SESSION_COOKIE);
    } catch {
      // Server components may be forbidden from mutating cookies; the
      // destroyed session row already invalidates the token, so the stale
      // cookie is harmless.
    }
  }
  redirect(returnTo);
}
