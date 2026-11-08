import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import SiteLink from "@/components/site-link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import "../contact.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("contact");
}

/** Page /contact — « Nous contacter » (décision 08/11 : le lien footer
 *  ouvre une page développeurs au lieu d'un mailto brut). Cohérence
 *  /legal : l'e-mail publié (adrien.remond@protonmail.com) est celui des
 *  mentions légales ; GitHub AdrienRmd déjà référencé (mod-workbench),
 *  AustinLiu5567 déjà référencé (footer). Avatars initiales : patron
 *  .creator-avatar/.creator-initial du site (command.css), pas de photo. */
const DEVELOPERS = [
  {
    initial: "RA",
    name: "Remond Adrien",
    role: { zh: "开发", fr: "Développeur", en: "Developer" },
    github: { label: "github.com/AdrienRmd", href: "https://github.com/AdrienRmd" },
    email: "adrien.remond@protonmail.com",
  },
  {
    initial: "A",
    name: "Austin",
    role: { zh: "开发", fr: "Développeur", en: "Developer" },
    github: { label: "github.com/AustinLiu5567", href: "https://github.com/AustinLiu5567" },
  },
] as const;

export default function ContactPage() {
  return (
    <main className="contact-page">
      <h1>
        <T text="联系我们" />
      </h1>
      <p className="contact-intro">
        <T text="有问题、建议或想参与项目？以下是本站的开发者。" />
      </p>

      <section>
        <h2>
          <T text="开发者" />
        </h2>
        <ul className="contact-dev-list">
          {DEVELOPERS.map((dev) => (
            <li key={dev.name} className="contact-dev-card">
              <span className="creator-avatar creator-initial" aria-hidden="true">
                {dev.initial}
              </span>
              <div className="contact-dev-body">
                <p className="contact-dev-name">{dev.name}</p>
                <p className="contact-dev-role">
                  <T text={dev.role.zh} />
                </p>
                <p className="contact-dev-links">
                  <a href={dev.github.href} target="_blank" rel="noopener noreferrer">
                    {dev.github.label}
                  </a>
                  {"email" in dev ? (
                    <>
                      {" · "}
                      <a href={`mailto:${dev.email}`}>{dev.email}</a>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="contact-legal label-text">
          <T text="本站为非商业社区项目，详见法律信息页。" />
          <SiteLink href="/legal">
            <T text="法律信息" />
          </SiteLink>
        </p>
      </section>
    </main>
  );
}
