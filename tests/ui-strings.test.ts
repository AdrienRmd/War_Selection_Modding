import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { translate } from "@/lib/i18n";
import { kindLabels, publicationLabels, usageLabels } from "@/lib/mod-types";
import allowlist from "./ui-strings.allowlist.json";

// Scanner anti-régression : détecte le texte d'interface rendu à l'écran qui
// reste en anglais sous la locale fr. Sources scannées dans chaque .tsx de
// app/** et components/** :
//  1. les nœuds JSXText (texte littéral entre balises) ;
//  2. les props littérales chaîne [title, alt, placeholder, aria-label, label,
//     eyebrow, text] (eyebrow = surtitre rendu par PageTitle ; text = prop du
//     composant i18n <T>, toutes deux rendues via translate) ;
//  3. les paires (zh, en) du helper bilingue local l(zh, en) / b(zh, en) :
//     la chaîne EN est fautive si elle rend de l'anglais en fr, c'est-à-dire
//     si aucune clé (ni la zh, ni la EN) n'aboutit à une traduction française ;
//  4. les ternaires de locale `cond ? "English" : "中文"` : la branche sans
//     caractères chinois est fautive si translate(chaîne, "fr") la renvoie
//     inchangée.
// Convention qui en découle : les options rendues depuis un tableau de tuples
// (par exemple [["all", "全部来源", "All sources"]] + map) échappent à l'analyse
// (arguments non littéraux pour le scanner) ; il faut donc appeler l(zh, en)
// directement dans le tableau pour que la chaîne reste visible du scanner.
// components/ui/** reste volontairement scanné : ses libellés (sr-only,
// aria-label shadcn) sont visibles à l'écran et ont été branchés sur i18n.
// Une chaîne est considérée traduite si translate(chaine, "fr") la modifie,
// sauf passage par tests/ui-strings.allowlist.json (noms propres, termes
// identiques en français et exceptions volontaires, documentées).
// Complément : les libellés EN des tables de statuts de lib/mod-types.ts
// (usageLabels, kindLabels, publicationLabels) sont rendus via t(variable),
// invisible de l'AST ; le second test vérifie directement leur couverture FR.

const allowed = new Set(allowlist as string[]);
const propNames = new Set([
  "title",
  "alt",
  "placeholder",
  "aria-label",
  "label",
  "eyebrow",
  "text",
]);
const bilingualHelpers = new Set(["l", "b"]);
const roots = ["app", "components"];

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const isNoise = (text: string): boolean =>
  text.length < 3 ||
  !/[A-Za-z]{2,}/.test(text) || // chiffres, CJK pur, ponctuation
  /https?:\/\/|www\.|[A-Za-z0-9.+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+/.test(text) || // URLs / e-mails
  (/^[a-z][a-zA-Z0-9_-]*$/.test(text) && /[A-Z_-]/.test(text)) || // className (camelCase/kebab, sans espace)
  /^[A-Za-z]:\\/.test(text) || // chemins de fichiers
  /^\.[A-Za-z0-9]+$/.test(text) || // extensions (.lua)
  /^(data-|aria-|on[A-Z])/.test(text); // préfixes techniques

// La chaîne EN rend-elle de l'anglais sous la locale fr ?
const rendersEnglish = (zh: string, en: string): boolean => {
  if (translate(en, "fr") !== en) return false; // clé EN traduite en fr
  const viaZh = translate(zh, "fr");
  return viaZh === zh || viaZh === en; // clé zh absente ou sans traduction fr
};

interface Occurrence {
  file: string;
  line: number;
}

const offenders = new Map<string, Occurrence[]>();
const files = roots.flatMap((root) => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : entry.name.endsWith(".tsx") ? [full] : [];
    });
  return walk(root).sort();
});

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const position = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const record = (raw: string, node: ts.Node) => {
    const text = normalize(decodeEntities(raw));
    if (!text || isNoise(text) || allowed.has(text) || translate(text, "fr") !== text) return;
    const bucket = offenders.get(text) ?? [];
    bucket.push({ file: file.replace(/\\/g, "/"), line: position(node) });
    offenders.set(text, bucket);
  };
  const recordIfEnglish = (zh: string, en: string, node: ts.Node) => {
    if (rendersEnglish(zh, en)) record(en, node);
  };
  // Feuilles littérales d'une expression : littéral, template statique ou
  // ternaire (les autres expressions ne sont pas du texte rendu statique).
  const leaves = (node: ts.Expression): string[] => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isConditionalExpression(node))
      return [...leaves(node.whenTrue), ...leaves(node.whenFalse)];
    return [];
  };
  const hasCJK = (text: string) => /[\u4e00-\u9fff]/.test(text);
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      record(node.getText(source), node);
    } else if (
      ts.isJsxAttribute(node) &&
      propNames.has(node.name.getText(source)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      record(node.initializer.text, node);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      bilingualHelpers.has(node.expression.text) &&
      node.arguments.length >= 2
    ) {
      const zh = leaves(node.arguments[0]);
      const en = leaves(node.arguments[1]);
      if (zh.length && zh.length === en.length) {
        zh.forEach((text, i) => recordIfEnglish(text, en[i], node));
      } else {
        en.forEach((text) => recordIfEnglish("", text, node));
      }
    } else if (ts.isConditionalExpression(node)) {
      const branches = [node.whenTrue, node.whenFalse].flatMap(leaves);
      if (branches.length === 2 && hasCJK(branches[0]) !== hasCJK(branches[1])) {
        const en = hasCJK(branches[0]) ? branches[1] : branches[0];
        recordIfEnglish("", en, node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

describe("scanner des chaînes d'interface", () => {
  it("branche tout le texte rendu sur i18n (locale fr)", () => {
    const report = [...offenders.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([text, where]) =>
          `  "${text}"\n    → ${[...new Set(where.map((w) => `${w.file}:${w.line}`))].join(", ")}`,
      );
    expect(
      report,
      `${report.length} chaîne(s) d'interface rendue en anglais sous la locale fr (inventaire à corriger) :\n${report.join("\n")}`,
    ).toEqual([]);
  });

  it("traduit les libellés EN des tables de statuts (usage, kind, publication)", () => {
    const tables: [string, Record<string, [string, string]>][] = [
      ["usageLabels", usageLabels],
      ["kindLabels", kindLabels],
      ["publicationLabels", publicationLabels],
    ];
    const report = tables.flatMap(([name, table]) =>
      Object.entries(table)
        .filter(([, [, en]]) => !allowed.has(en) && translate(en, "fr") === en)
        .map(([key, [, en]]) => `  ${name}.${key} → "${en}"`),
    );
    expect(
      report,
      `${report.length} libellé(s) de statut rendu(s) en anglais sous la locale fr :\n${report.join("\n")}`,
    ).toEqual([]);
  });
});
