/// <reference types="vite/client" />
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-server";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/signin";
const SIGN_OUT_PATH = "/signout";
const CALLBACK_PATH = "/callback";
const LOCAL_AUTH_COOKIE = "__sites_local_auth";
// Mirror of the sites-vite-plugin dev identity. Only reachable behind
// import.meta.env.DEV, which Vite replaces with a build-time constant so the
// branch is dead-code-eliminated from production bundles.
const LOCAL_DEV_USER: ChatGPTUser = {
  userId: "local_seedy",
  displayName: "Seedy",
  email: "seedy@sites.test",
  fullName: "Seedy",
};

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const user = await getSessionUser();
  if (user) return user;

  // Dev-only shim: keep the `__sites_local_auth=1` simulation working for the
  // scripts/test-*.mjs suites. No oai-authenticated-user-* header is ever
  // trusted here; production identity comes exclusively from the session.
  if (import.meta.env.DEV) {
    if ((await cookies()).get(LOCAL_AUTH_COOKIE)?.value === "1") return LOCAL_DEV_USER;
  }
  return null;
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  let url: URL;
  try {
    url = new URL(value, "https://app.local");
  } catch {
    return "/";
  }
  if (url.origin !== "https://app.local") return "/";
  if (isReservedAuthPath(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return pathname === SIGN_IN_PATH || pathname === SIGN_OUT_PATH || pathname === CALLBACK_PATH;
}
