"use client";
import Link from "@/components/site-link";
import { ArrowUpRight } from "lucide-react";
import { T, useI18n } from "@/components/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div className="site-footer-brand">
          <p className="site-footer-brandline">
            WS <b>ATLAS</b>
          </p>
          <p className="muted">
            <T text="玩家共建的非官方社区档案。" />
          </p>
        </div>
        <nav className="site-footer-col" aria-label={t("探索")}>
          <p className="site-footer-title">
            <T text="探索" />
          </p>
          <ul>
            <li>
              <Link href="/maps">
                <T text="地图档案" />
              </Link>
            </li>
            <li>
              <Link href="/mods">
                <T text="Mod 资料库" />
              </Link>
            </li>
            <li>
              <Link href="/submit">
                <T text="提交作品" />
              </Link>
            </li>
          </ul>
        </nav>
        <nav className="site-footer-col" aria-label={t("法律信息")}>
          <p className="site-footer-title">
            <T text="法律信息" />
          </p>
          <ul>
            <li>
              <Link href="/legal">
                <T text="法律声明" />
              </Link>
            </li>
            <li>
              <Link href="/privacy">
                <T text="隐私政策" />
              </Link>
            </li>
            <li>
              <Link href="/terms">
                <T text="使用条款" />
              </Link>
            </li>
          </ul>
        </nav>
        <nav className="site-footer-col" aria-label={t("社区")}>
          <p className="site-footer-title">
            <T text="社区" />
          </p>
          <ul>
            <li>
              <a href="https://github.com/AustinLiu5567/ws-lab" target="_blank" rel="noreferrer">
                <T text="源代码" /> <ArrowUpRight size={13} />
              </a>
            </li>
            <li>
              <a href="https://www.warselection.com" target="_blank" rel="noreferrer">
                <T text="War Selection 官方网站" /> <ArrowUpRight size={13} />
              </a>
            </li>
            <li>
              <a href="mailto:adrien.remond@protonmail.com">
                <T text="联系我们" />
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>
          © {year} WS <b>ATLAS</b>
        </span>
        <p className="muted">
          <T text="非官方粉丝项目，与 Glyph Worlds 无关联；游戏及全部内容归其各自所有者所有。" />
        </p>
      </div>
    </footer>
  );
}
