import { describe, expect, it } from "vitest";
import {
  avatarKeyFor,
  displayNameIssue,
  initialsOf,
  inspectAvatar,
  inspectCover,
  normalizeAccountLocale,
  PROFILE_PATCH_BUDGET,
  profileAttemptKey,
  stripJpegMetadata,
  stripPngMetadata,
} from "@/lib/profile";

// ---------------------------------------------------------------------------
// Pseudo (SB1-a) : longueur, jeu de caractères, anti-usurpation admin.

describe("displayNameIssue", () => {
  it("accepte les pseudos valides (latin, accents, CJK, séparateurs)", () => {
    for (const name of ["Ada", "Ada Lovelace", "Zoé_42", "织田信长", "J.-C. Van Damme", "玩家一号"])
      expect(displayNameIssue(name), name).toBeUndefined();
  });

  it("trim avant toute validation", () => {
    expect(displayNameIssue("  Ada  ")).toBeUndefined();
  });

  it("refuse les longueurs hors 2–40", () => {
    expect(displayNameIssue("A")).toBe("昵称长度需在 2 到 40 个字符之间。");
    expect(displayNameIssue(" ".repeat(41))).toContain("昵称长度");
    expect(displayNameIssue("a".repeat(41))).toContain("昵称长度");
  });

  it("refuse espaces doubles, tabulations, contrôles et emojis", () => {
    expect(displayNameIssue("Ada  Lo")).toContain("空格");
    expect(displayNameIssue("Ada\tLo")).toContain("空格");
    expect(displayNameIssue("Ad\na")).toBeTruthy();
    expect(displayNameIssue("😀42")).toContain("昵称只能");
  });

  it("refuse les débuts/fins par séparateur", () => {
    expect(displayNameIssue("-Ada")).toContain("昵称只能");
    expect(displayNameIssue("Ada.")).toContain("昵称只能");
  });

  it("refuse les pseudos réservés, insensible casse/séparateurs (usurpation admin)", () => {
    for (const name of ["admin", "ADMIN", "Admin", "a d m i n", "adm in", "管理员", "ATLAS", "War Selection", "STAFF"])
      expect(displayNameIssue(name), name).toBe("该昵称不可使用。");
  });

  it("laisse passer un pseudo proche mais distinct", () => {
    expect(displayNameIssue("Administrator de service")).toBeUndefined();
    expect(displayNameIssue("Atlasien")).toBeUndefined();
  });
});

describe("initialsOf", () => {
  it("initiales premier + dernier mot", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("jean claude van damme")).toBe("JD");
  });
  it("mot unique : premier caractère (CJK inclus)", () => {
    expect(initialsOf("织田信长")).toBe("织");
    expect(initialsOf("Seedy")).toBe("S");
  });
});

// ---------------------------------------------------------------------------
// Avatars (SB1-b/c) : magic bytes, borne 2 Mo, neutralisation EXIF serveur.

const chars = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));
const jpegSeg = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
};
const jpegWithExif = () =>
  new Uint8Array([
    0xff,
    0xd8, // SOI
    ...jpegSeg(0xe0, [...chars("JFIF\0"), 1, 2, 0, 0, 0, 0]), // APP0 JFIF
    ...jpegSeg(
      0xe1,
      [...chars("Exif\0\0"), 0x4d, 0x4d, 0, 42, ...new Array(20).fill(7)], // APP1 EXIF (GPS bidon)
    ),
    ...jpegSeg(0xfe, chars("Commentaire secret")), // COM
    ...jpegSeg(0xdb, [0, 1, 2, 3]), // DQT
    ...jpegSeg(0xc0, [0, 1, 2, 3]), // SOF0
    0xff,
    0xda, // SOS
    0x12, 0x34, 0x56, // flux entropique
    0xff,
    0xd9, // EOI
  ]);

const pngChunk = (type: string, data: number[]) => {
  const body = [data.length >>> 24, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255];
  const crc = [1, 2, 3, 4]; // recopié tel quel : la valeur n'importe pas ici
  return [...body, ...Array.from(type).map((c) => c.charCodeAt(0)), ...data, ...crc];
};
const pngWithMeta = () =>
  new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, // signature
    ...pngChunk("IHDR", new Array(13).fill(1)),
    ...pngChunk("eXIf", [0, 42, 7, 7, 7, 7]), // EXIF
    ...pngChunk("tEXt", [...chars("Auteur"), 0, ...chars("Ada")]), // texte
    ...pngChunk("IEND", []),
  ]);

describe("stripJpegMetadata", () => {
  it("supprime APP1 EXIF et COM, conserve APP0/DQT/SOF/entropie/EOI", () => {
    const out = stripJpegMetadata(jpegWithExif())!;
    const text = new TextDecoder().decode(out);
    expect(out[0]).toBe(0xff);
    expect(out[1]).toBe(0xd8);
    expect(text).toContain("JFIF");
    expect(text).not.toContain("Exif");
    expect(text).not.toContain("Commentaire");
    // DQT (0xDB) et SOF0 (0xC0) conservés
    expect(out.includes(0xdb)).toBe(true);
    expect(out.includes(0xc0)).toBe(true);
    // entropie + EOI intacts
    expect(out[out.length - 1]).toBe(0xd9);
    expect(out[out.length - 2]).toBe(0xff);
    expect(Array.from(out.slice(-5, -2))).toEqual([0x12, 0x34, 0x56]);
  });

  it("refuse un JPEG désynchronisé (sans SOS)", () => {
    const broken = new Uint8Array([0xff, 0xd8, 0x00, 0xff, 0xd9]);
    expect(stripJpegMetadata(broken)).toBeNull();
  });

  it("refuse un JPEG tronqué (segment dépassant le fichier)", () => {
    const truncated = jpegWithExif().slice(0, 20);
    expect(stripJpegMetadata(truncated)).toBeNull();
  });
});

describe("stripPngMetadata", () => {
  it("supprime eXIf et tEXt, conserve signature/IHDR/IEND", () => {
    const source = pngWithMeta();
    const out = stripPngMetadata(source)!;
    const text = new TextDecoder().decode(out);
    expect(text).not.toContain("eXIf");
    expect(text).not.toContain("Auteur");
    expect(text).toContain("IHDR");
    expect(text).toContain("IEND");
    // taille réduite d'exactement les 2 chunks retirés (12 + data de chacun)
    const dropped = 12 + 6 + 12 + (6 + 1 + 3);
    expect(out.length).toBe(source.length - dropped);
    expect(out.length).toBeGreaterThan(8);
  });

  it("refuse un PNG sans IEND", () => {
    const broken = pngWithMeta().slice(0, 8 + 25);
    expect(stripPngMetadata(broken)).toBeNull();
  });
});

describe("inspectAvatar", () => {
  it("accepte un PNG propre et le retourne intact", () => {
    const png = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10,
      ...pngChunk("IHDR", new Array(13).fill(1)),
      ...pngChunk("IEND", []),
    ]);
    const result = inspectAvatar(png);
    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.type).toBe("image/png");
    expect(result.bytes.length).toBe(png.length);
  });

  it("neutralise l'EXIF d'un JPEG avant tout usage", () => {
    const result = inspectAvatar(jpegWithExif());
    expect("error" in result).toBe(false);
    if ("error" in result) throw new Error("unreachable");
    expect(result.type).toBe("image/jpeg");
    expect(new TextDecoder().decode(result.bytes)).not.toContain("Exif");
  });

  it("refuse les mauvais types (GIF), le vide et le dépassement 2 Mo", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2, 3]);
    const gifResult = inspectAvatar(gif);
    if (!("error" in gifResult)) throw new Error("unreachable");
    expect(gifResult.error).toBe("头像只接受 PNG 或 JPEG 图片。");
    const empty = inspectAvatar(new Uint8Array(0));
    if (!("error" in empty)) throw new Error("unreachable");
    expect(empty.error).toContain("无效");
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff], 0);
    const bigResult = inspectAvatar(big);
    if (!("error" in bigResult)) throw new Error("unreachable");
    expect(bigResult.error).toBe("头像不能超过 2 MB。");
  });

  it("refuse un PNG à la structure cassée malgré une signature valide", () => {
    const broken = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const result = inspectAvatar(broken);
    if (!("error" in result)) throw new Error("unreachable");
    expect(result.error).toContain("无效");
  });
});

describe("inspectCover — couvertures de cartes (MINEUR #3, même norme avatars)", () => {
  it("PNG avec eXIf/tEXt → octets purgés, type image/png", () => {
    const result = inspectCover(pngWithMeta());
    if ("error" in result) throw new Error("unreachable");
    expect(result.type).toBe("image/png");
    const text = new TextDecoder().decode(result.bytes);
    expect(text).not.toContain("eXIf");
    expect(text).not.toContain("Auteur");
    expect(text).toContain("IHDR");
  });

  it("JPEG avec EXIF/COM → purgé, type image/jpeg", () => {
    const result = inspectCover(jpegWithExif());
    if ("error" in result) throw new Error("unreachable");
    expect(result.type).toBe("image/jpeg");
    const text = new TextDecoder().decode(result.bytes);
    expect(text).not.toContain("Exif");
    expect(text).toContain("JFIF");
  });

  it("messages d'erreur spécifiques couverture (vides/invalide/non image)", () => {
    const cases: [Uint8Array, string][] = [
      [new Uint8Array(0), "封面文件无效，请重新选择。"],
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 9]), "封面文件无效，请重新选择。"],
      [new Uint8Array([71, 73, 70, 56, 57, 97]), "封面仅支持 PNG 或 JPEG 图片。"],
    ];
    for (const [bytes, expected] of cases) {
      const result = inspectCover(bytes);
      if (!("error" in result)) throw new Error("unreachable");
      expect(result.error, JSON.stringify(Array.from(bytes))).toBe(expected);
    }
  });

  it("inspectAvatar et inspectCover partagent le cœur inspectImage (mêmes octets purgés)", () => {
    const avatar = inspectAvatar(pngWithMeta());
    const cover = inspectCover(pngWithMeta());
    if ("error" in avatar || "error" in cover) throw new Error("unreachable");
    expect(Array.from(cover.bytes)).toEqual(Array.from(avatar.bytes));
  });
});

describe("clés et budgets", () => {
  it("clé R2 d'avatar dérivée de l'userId, jamais du nom de fichier", () => {
    expect(avatarKeyFor("u-123")).toBe("avatars/u-123/avatar");
  });
  it("budget PATCH : 10 modifications / 60 s, clé par compte", () => {
    expect(PROFILE_PATCH_BUDGET).toEqual({ limit: 10, windowMs: 60000 });
    expect(profileAttemptKey("user-1")).toBe("profile:user-1");
    expect(profileAttemptKey("x".repeat(100))).toBe(`profile:${"x".repeat(64)}`);
  });
  it("locales de compte : zh/en/fr acceptées, reste rejeté", () => {
    expect(normalizeAccountLocale("zh")).toBe("zh");
    expect(normalizeAccountLocale("fr")).toBe("fr");
    expect(normalizeAccountLocale("FR")).toBeNull();
    expect(normalizeAccountLocale("de")).toBeNull();
    expect(normalizeAccountLocale(42)).toBeNull();
  });
});
