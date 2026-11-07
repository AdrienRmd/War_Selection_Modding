import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import { LocalizedImage } from "@/components/localized-media";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { identity } from "@/lib/atlas-server";
import { creatorProfile, CREATOR_PLATFORMS } from "@/lib/creators-server";
import { Map as MapIcon, Puzzle, ArrowUpRight, Clock } from "lucide-react";
import "../../creators.css";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("creatorProfile");
}

function initials(name: string) {
  const clean = name.trim();
  return clean ? clean.slice(0, 2).toUpperCase() : "?";
}

/** Page /createurs/<id> — profil public : photo, présentation, réseaux
 *  (https whitelist, noopener noreferrer nofollow), section Mods et
 *  section Cartes (rapprochement automatique par compte propriétaire +
 *  associations manuelles validées en modération). Une candidature non
 *  publiée n'est visible que de son auteur et des admins (bandeau d'état). */
export default async function CreatorProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const locale = await requestLocale();
  const { user, admin } = await identity();
  const profile = await creatorProfile(id, { id: user?.userId ?? null, admin }).catch(() => null);
  if (!profile) notFound();
  const loc = locale as Locale;
  const maps = [
    ...profile.autoMaps.map((m) => ({ ...m, manual: false })),
    ...profile.manualMaps.map((m) => ({ ...m, manual: true })),
  ];
  const mods = [
    ...profile.autoMods.map((m) => ({ ...m, manual: false })),
    ...profile.manualMods.map((m) => ({ ...m, manual: true })),
  ];
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        {profile.status !== "published" ? (
          <p role="status" className="notice">
            <T text="此档案尚未公开（等待审核或已撤回），仅作者与管理员可见。" />
          </p>
        ) : null}
        <header className="creator-profile-head panel">
          {profile.has_photo ? (
            <LocalizedImage
              className="creator-avatar creator-avatar-lg"
              src={`/api/creators/${profile.id}`}
              alt={profile.name}
              width={112}
              height={112}
            />
          ) : (
            <span className="creator-avatar creator-avatar-lg creator-initial" aria-hidden="true">
              {initials(profile.name)}
            </span>
          )}
          <div className="creator-profile-id">
            <p className="eyebrow">
              <T text="内容创作者" />
            </p>
            <h1>{profile.name}</h1>
            {profile.role ? <p className="label-text">{profile.role}</p> : null}
            {profile.bio ? <p className="creator-profile-bio">{profile.bio}</p> : null}
            {profile.links.length ? (
              <ul className="creators-links" aria-label={translate("社交网络", loc)}>
                {profile.links.map((link) => (
                  <li key={link.platform}>
                    <a
                      className="creators-link-chip"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      {CREATOR_PLATFORMS[link.platform]?.label ?? link.platform}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        <section className="creator-profile-section panel" aria-labelledby="creator-maps-title">
          <h2 id="creator-maps-title" className="heading-flex">
            <MapIcon size={18} aria-hidden="true" />
            {translate(`${profile.mapsCount} 张地图`, loc)}
          </h2>
          {maps.length ? (
            <ul className="creator-items">
              {maps.map((m) => (
                <li key={`map-${m.id}-${m.manual ? "m" : "a"}`}>
                  <Link className="creator-item" href={`/maps/${m.id}`}>
                    <strong>{m.title}</strong>
                    <span className="label-text">
                      {m.players} <T text="人" /> · {m.category}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="label-text">
              <T text="暂无公开地图。" />
            </p>
          )}
        </section>

        <section className="creator-profile-section panel" aria-labelledby="creator-mods-title">
          <h2 id="creator-mods-title" className="heading-flex">
            <Puzzle size={18} aria-hidden="true" />
            {translate(`${profile.modsCount} 个 Mod`, loc)}
          </h2>
          {mods.length ? (
            <ul className="creator-items">
              {mods.map((m) => (
                <li key={`mod-${m.id}-${m.manual ? "m" : "a"}`}>
                  <Link className="creator-item" href={`/mods/${m.id}`}>
                    <strong>{m.title}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="label-text">
              <T text="暂无公开 Mod。" />
            </p>
          )}
        </section>

        {profile.mine ? (
          <p className="label-text creator-profile-meta">
            <Clock size={14} aria-hidden="true" /> <T text="这是你的创作者档案。" />
          </p>
        ) : null}
      </main>
      <AtlasFooter />
    </>
  );
}
