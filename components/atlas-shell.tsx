import Link from "@/components/site-link";
import { ArrowUpRight } from "lucide-react";
import { LanguageSwitcher, T } from "@/components/i18n";
import { AtlasNav } from "@/components/atlas-nav";
import { AccountMenu } from "@/components/account-menu";
import { SiteFooter } from "@/components/site-footer";
import { identity } from "@/lib/atlas-server";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
export async function AtlasHeader() {
  const { user, admin } = await identity();
  return (
    <>
      <LanguageSwitcher />
      <header className="header">
        <Link className="brand" href="/">
          <img className="atlas-emblem" src="/atlas-emblem-96.png" alt="" width={44} height={44} />
          <span>
            WS <b>ATLAS</b>
            <small>WAR SELECTION · COMMUNITY</small>
          </span>
        </Link>
        <AtlasNav />
        <div className="header-actions">
          {user ? (
            <AccountMenu
              displayName={user.displayName}
              avatarKey={user.avatarKey ?? null}
              admin={admin}
              signOutHref={chatGPTSignOutPath()}
            />
          ) : (
            <a className="account-link" href={chatGPTSignInPath("/")} target="_top">
              <T text={"登录"} />
            </a>
          )}
          <Link href="/submit" className="button primary">
            <T text="提交作品" /> <ArrowUpRight size={17} />
          </Link>
        </div>
      </header>
    </>
  );
}
export function AtlasFooter() {
  return <SiteFooter />;
}
export function PageTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">
        <T text={eyebrow} />
      </p>
      <h1>
        <T text={title} />
      </h1>
      <p className="muted">
        <T text={text} />
      </p>
    </div>
  );
}
