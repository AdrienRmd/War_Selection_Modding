"use client";
import Link from "@/components/site-link";
import { T, useI18n } from "@/components/i18n";
import { legalDocs, type LegalDocKey } from "@/lib/legal";

const docOrder: LegalDocKey[] = ["legal", "privacy", "terms"];

export function LegalDocViewer({ docKey }: { docKey: LegalDocKey }) {
  const { locale, t } = useI18n();
  const doc = legalDocs[docKey][locale];
  return (
    <article className="legal-doc prose">
      <p className="eyebrow">
        <T text="法律信息" />
      </p>
      <h1>{doc.title}</h1>
      <p className="legal-doc-updated muted">{t(`最后更新于 ${doc.updated}`)}</p>
      {doc.intro ? <p className="legal-doc-intro">{doc.intro}</p> : null}
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph, index) => (
            // Index-suffixed key: legal texts may contain verbatim repeated
            // paragraphs, which would collide under key={paragraph} alone.
            <p key={`${paragraph}-${index}`}>{paragraph}</p>
          ))}
        </section>
      ))}
      <nav className="legal-doc-links" aria-label={t("相关文档")}>
        <span className="muted">
          <T text="相关文档" />
        </span>
        {docOrder.map((key) => (
          <Link key={key} href={`/${key}`} aria-current={key === docKey ? "page" : undefined}>
            <T text={legalDocs[key][locale].title} />
          </Link>
        ))}
      </nav>
    </article>
  );
}
