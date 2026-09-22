import { redirect } from "next/navigation";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { SignInForm } from "@/components/auth-forms";

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
  if (["/signin", "/signup", "/signout", "/callback"].includes(url.pathname)) return "/";

  return `${url.pathname}${url.search}${url.hash}`;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const returnTo = safeRelativeReturnPath((await searchParams).return_to || "/");
  if (await getChatGPTUser()) redirect(returnTo);
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="ACCOUNT ACCESS"
          title="登录 WS ATLAS。"
          text="使用邮箱与密码登录，继续投稿与管理你的作品。"
        />
        <div className="auth-layout">
          <SignInForm returnTo={returnTo} />
        </div>
      </main>
      <AtlasFooter />
    </>
  );
}
