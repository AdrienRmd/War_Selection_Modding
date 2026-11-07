import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import { LocalizedImage } from "@/components/localized-media";
import Link from "@/components/site-link";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { translate } from "@/lib/i18n";
import { identity } from "@/lib/atlas-server";
import { listPublishedCreators, CREATOR_PLATFORMS, type CreatorCard } from "@/lib/creators-server";
import { Users } from "lucide-react";
import "../creators.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("creators");
}

function initials(name: string) {
  const clean = name.trim();
  return clean ? clean.slice(0, 2).toUpperCase() : "?";
}

/** Badge réseau d'une carte créateur (libellé localisé de la plateforme). */
function CreatorLinks({ links, locale }: { links: CreatorCard["links"]; locale: "zh" | "en" | "fr" }) {
  if (!links.length) return null;
  return (
    <ul className="creators-links" aria-label={translate("社交网络", locale)}>
      {links.map((link) => (
        <li key={link.platform}>
          <a
            className="creators-link-chip"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {CREATOR_PLATFORMS[link.platform]?.label ?? link.platform}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Page /createurs — annuaire public des créateurs de contenu publiés
 *  (carte : photo, nom, réseaux, compteurs mods/cartes). La bannière
 *  d'accueil reste servie par components/creators-banner.tsx (inchangée). */
export default async function CreatorsPage() {
  const locale = await requestLocale();
  let creators: CreatorCard[] = [];
  try {
    creators = await listPublishedCreators();
  } catch {
    creators = [];
  }
  const { user } = await identity();
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <PageTitle
          eyebrow="CREATORS"
          title={translate("内容创作者", locale)}
          text={translate("他们制作地图与 Mod，在这里被看见：作品、频道与社区。", locale)}
        />
        <div className="creators-toolbar">
          {!user ? (
            <Link className="button" href="/signin?return_to=%2Fcreateurs">
              <T text="登录后申请成为创作者" />
            </Link>
          ) : (
            <Link className="button" href="/createurs/candidature">
              <Users size={16} />
              <T text="申请成为创作者" />
            </Link>
          )}
        </div>
        {creators.length ? (
          <ul className="creators-directory">
            {creators.map((c) => (
              <li className="creators-card panel" key={c.id}>
                <Link className="creators-card-head" href={`/createurs/${c.id}`}>
                  {c.has_photo ? (
                    <LocalizedImage
                      className="creator-avatar"
                      src={`/api/creators/${c.id}`}
                      alt={c.name}
                      loading="lazy"
                      width={72}
                      height={72}
                    />
                  ) : (
                    <span className="creator-avatar creator-initial" aria-hidden="true">
                      {initials(c.name)}
                    </span>
                  )}
                  <span className="creators-card-name">
                    <strong>{c.name}</strong>
                    {c.role ? <small>{c.role}</small> : null}
                  </span>
                </Link>
                {c.bio ? <p className="creators-card-bio">{c.bio}</p> : null}
                <CreatorLinks links={c.links} locale={locale} />
                <p className="creators-card-counts label-text">
                  {translate(`${c.mapsCount} 张地图 · ${c.modsCount} 个 Mod`, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-surface">
            <T text="还没有公开的创作者档案。" />
          </p>
        )}
      </main>
      <AtlasFooter />
    </>
  );
}
