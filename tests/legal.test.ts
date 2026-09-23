import { describe, expect, it } from "vitest";
import type { Locale } from "@/lib/i18n";
import { legalDocs, type LegalDoc, LegalDocKey } from "@/lib/legal";

const docKeys: LegalDocKey[] = ["legal", "privacy", "terms"];
const locales: Locale[] = ["zh", "en", "fr"];

const stringsOf = (doc: LegalDoc): string[] => [
  doc.title,
  doc.intro ?? "",
  ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs]),
];

describe("structure des documents légaux", () => {
  it("définit les 3 documents × 3 locales", () => {
    for (const key of docKeys)
      for (const locale of locales) expect(legalDocs[key][locale], `${key}/${locale}`).toBeTruthy();
  });

  it("compte le même nombre de sections par locale pour chaque document", () => {
    expect(legalDocs.legal.zh.sections).toHaveLength(6);
    expect(legalDocs.privacy.zh.sections).toHaveLength(8);
    expect(legalDocs.terms.zh.sections).toHaveLength(8);
    for (const key of docKeys) {
      const counts = locales.map((l) => legalDocs[key][l].sections.length);
      expect(new Set(counts).size, `${key} : ${counts.join(", ")}`).toBe(1);
    }
  });

  it("n'a ni titre, ni intro, ni intertitre, ni paragraphe vide", () => {
    for (const key of docKeys)
      for (const locale of locales) {
        const doc = legalDocs[key][locale];
        expect(doc.title.trim(), `${key}/${locale} title`).not.toBe("");
        expect(doc.intro?.trim(), `${key}/${locale} intro`).not.toBe("");
        for (const section of doc.sections) {
          expect(section.heading.trim(), `${key}/${locale} heading`).not.toBe("");
          expect(section.paragraphs.length, `${key}/${locale} paragraphs`).toBeGreaterThan(0);
          for (const p of section.paragraphs) expect(p.trim()).not.toBe("");
        }
      }
  });

  it("porte une date de mise à jour ISO, identique dans les 3 locales", () => {
    for (const key of docKeys) {
      const dates = locales.map((l) => legalDocs[key][l].updated);
      for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Set(dates).size, `${key} : ${dates.join(", ")}`).toBe(1);
    }
  });

  it("ne contient aucun placeholder ${} cassé dans les 3 langues", () => {
    for (const key of docKeys)
      for (const locale of locales)
        for (const text of stringsOf(legalDocs[key][locale]))
          expect(text.includes("${"), `${key}/${locale} : « ${text.slice(0, 40)} »`).toBe(false);
  });
});

describe("invariants éditoriaux", () => {
  it("mentionne l'éditeur et le domaine dans chaque locale des mentions légales", () => {
    for (const locale of locales) {
      const text = stringsOf(legalDocs.legal[locale]).join("\n");
      expect(text).toContain("adrien.remond@protonmail.com");
      expect(text).toContain("aremond.ovh");
      expect(text).toContain("OVHcloud");
    }
  });

  it("décrit les deux cookies essentiels dans chaque locale de la politique de confidentialité", () => {
    for (const locale of locales) {
      const text = stringsOf(legalDocs.privacy[locale]).join("\n");
      expect(text).toContain("atlas_session");
      expect(text).toContain("atlas_locale");
      expect(text).toContain("PBKDF2");
    }
  });

  it("rattache les CGU au droit français dans chaque locale", () => {
    const governingLaw: Record<Locale, string> = {
      zh: "法国法律",
      en: "French law",
      fr: "droit français",
    };
    for (const locale of locales) {
      const text = stringsOf(legalDocs.terms[locale]).join("\n");
      expect(text).toContain(governingLaw[locale]);
      expect(text).toContain("Mod");
    }
  });
});
