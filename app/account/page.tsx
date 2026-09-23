import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { isAdmin } from "@/lib/atlas-server";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import { SignOutAllButton } from "@/components/auth/signout-all-button";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireChatGPTUser("/account");
  const admin = isAdmin(user);
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="ACCOUNT"
          title="我的账号"
          text="查看账号资料、修改密码并管理登录会话。"
        />
        <div className="auth-layout">
          <section className="panel">
            <h2>
              <T text="账号资料" />
            </h2>
            <p className="meta">
              <T text="显示名称" />：<strong>{user.displayName}</strong>
            </p>
            <p className="meta">
              <T text="邮箱" />：<strong>{user.email}</strong>
            </p>
            {admin && (
              <p>
                <span className="status admin">
                  <T text="管理员" />
                </span>
              </p>
            )}
          </section>
          <ChangePasswordForm />
          {admin && (
            <section className="panel">
              <h3>
                <T text="管理" />
              </h3>
              <p className="meta muted">
                <T text="此账号可以审核地图与 Mod 投稿。" />
              </p>
              <Link className="button primary" href="/admin">
                <T text="打开管理员审核台" />
              </Link>
            </section>
          )}
          <section className="panel">
            <h3>
              <T text="登录会话" />
            </h3>
            <div className="review-buttons">
              <a className="account-link" href={chatGPTSignOutPath("/account")} target="_top">
                <T text="退出登录" />
              </a>
              <SignOutAllButton />
            </div>
          </section>
        </div>
      </main>
      <AtlasFooter />
    </>
  );
}
