import Link from "@/components/site-link";
import { ArrowUpRight } from "lucide-react";
import { LanguageSwitcher, T } from "@/components/i18n";
import { AtlasNav } from "@/components/atlas-nav";
import { identity } from "@/lib/atlas-server";
import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
export async function AtlasHeader() {
  const { user, admin } = await identity();
  return (
    <>
      <LanguageSwitcher />
      <header className="header">
        <Link className="brand" href="/">
          <img className="atlas-emblem" src="/atlas-emblem-v4.png" alt="" width={48} height={48} />
          <span>
            WS <b>ATLAS</b>
            <small>WAR SELECTION · COMMUNITY</small>
          </span>
        </Link>
        <AtlasNav admin={admin} />
        <div className="header-actions">
          {user ? (
            <>
              <span className="account-name">{user.displayName}</span>
              <a className="account-link" href={chatGPTSignOutPath()} target="_top">
                <T text={"退出登录"} />
              </a>
            </>
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
  return (
    <footer className="footer">
      <span>
        WS ATLAS{" "}
        <span className="muted">
          <T text={"/ 地图与 Mod，玩家共创。"} />
        </span>
      </span>
      <div>
        <Link href="/guidelines">
          <T text={"投稿与审核规范"} />
        </Link>
        <span>
          {" "}
          <T text={"· 非 War Selection 官方网站"} />
        </span>
      </div>
    </footer>
  );
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
