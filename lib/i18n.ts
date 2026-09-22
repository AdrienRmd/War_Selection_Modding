import { english } from "./english";
import { french } from "./french";
export type Locale = "zh" | "en" | "fr";
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const own = (dictionary: Record<string, string>, key: string) =>
  Object.hasOwn(dictionary, key) ? dictionary[key] : undefined;
interface Template {
  prefix: string;
  pattern: RegExp;
  names: string[];
  target: string;
}
interface Dictionary {
  entries: Record<string, string>;
  normalized: Record<string, string>;
  templates: Template[];
}
// Dictionary placeholders are identifiers, never executable JavaScript. Each
// source placeholder captures text and is substituted by name in the target.
// Dictionaries, normalized keys and template regexes are compiled once per
// module load instead of being rebuilt on every call.
const buildDictionary = (entries: Record<string, string>): Dictionary => ({
  entries,
  normalized: Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [normalize(key), value]),
  ),
  templates: Object.entries(entries)
    .filter(([key]) => key.includes("${"))
    .map(([source, target]) => {
      const slots = [...source.matchAll(/\$\{([^{}]+)\}/g)];
      let end = 0,
        pattern = "^";
      for (const slot of slots) {
        pattern += escapePattern(source.slice(end, slot.index)) + "([\\s\\S]*?)";
        end = slot.index! + slot[0].length;
      }
      pattern += escapePattern(source.slice(end)) + "$";
      return {
        prefix: source.slice(0, slots[0]?.index ?? source.length),
        pattern: new RegExp(pattern),
        names: slots.map((s) => s[1]),
        target,
      };
    }),
});
const dictionaries = { en: buildDictionary(english), fr: buildDictionary(french) };
// French falls back to the English dictionary, then to the original text.
const chains: Record<"en" | "fr", Dictionary[]> = {
  en: [dictionaries.en],
  fr: [dictionaries.fr, dictionaries.en],
};
const exactIn = (dictionary: Dictionary, text: string) =>
  own(dictionary.entries, text) ?? own(dictionary.normalized, normalize(text));
const exactThrough = (chain: Dictionary[], text: string) => {
  for (const dictionary of chain) {
    const direct = exactIn(dictionary, text);
    if (direct !== undefined) return direct;
  }
  return undefined;
};
const lookup = (chain: Dictionary[], text: string) => {
  const direct = exactThrough(chain, text);
  if (direct !== undefined) return direct;
  // Bound dynamic matching to short UI messages rather than uploaded documents.
  if (text.length > 4096) return undefined;
  for (const dictionary of chain) {
    for (const template of dictionary.templates) {
      if (template.prefix && !text.startsWith(template.prefix)) continue;
      const match = template.pattern.exec(text);
      if (!match) continue;
      const values = new Map(
        template.names.map((name, index) => [
          name,
          exactThrough(chain, match[index + 1]) ?? match[index + 1],
        ]),
      );
      return template.target.replace(
        /\$\{([^{}]+)\}/g,
        (original, name: string) => values.get(name) ?? original,
      );
    }
  }
  return undefined;
};
const validationPrefix = "导出校验未通过，请检查改动：";
const cache = new Map<string, string>();
const cacheLimit = 2000;
const remember = (key: string, value: string) => {
  if (cache.size >= cacheLimit) cache.clear();
  cache.set(key, value);
  return value;
};
export function translate(text: string, locale: Locale) {
  if (locale === "zh") return text;
  const key = `${text}\u0000${locale}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const translated = lookup(chains[locale], text);
  if (translated !== undefined) return remember(key, translated);
  if (text.startsWith(validationPrefix))
    return remember(
      key,
      (exactThrough(chains[locale], validationPrefix) ?? validationPrefix) +
        text.slice(validationPrefix.length),
    );
  return remember(key, text);
}
