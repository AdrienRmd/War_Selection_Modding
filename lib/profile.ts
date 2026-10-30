// Helpers partagés client/serveur pour le profil éditable (SB1/SB2) :
// validation du pseudo, initiales de repli, inspection/neutralisation des
// avatars (magic bytes + purge EXIF côté serveur — le client n'est jamais
// cru), et budget de throttling du PATCH profil.

export const ACCOUNT_LOCALES = ["zh", "en", "fr"] as const;
export type AccountLocale = (typeof ACCOUNT_LOCALES)[number];

/** Locale de compte valide, ou null si la valeur ne fait pas partie du trio. */
export function normalizeAccountLocale(value: unknown): AccountLocale | null {
  return typeof value === "string" && (ACCOUNT_LOCALES as readonly string[]).includes(value)
    ? (value as AccountLocale)
    : null;
}

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// Pseudo : trim, 2–40 caractères, commence et finit par une lettre ou un
// chiffre ; à l'intérieur : lettres/chiffres Unicode, espaces simples, _ . -
// (pas de contrôle, pas d'emoji, pas d'espace double, pas de tabulation).
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}]([\p{L}\p{N} ._-]*[\p{L}\p{N}])?$/u;

// Pseudos réservés : comparaison insensible à la casse et aux séparateurs
// (_ . - et espaces retirés) — « A d M i N », «admin-», «.admin.» refusés.
const RESERVED_DISPLAY_NAMES = new Set(
  [
    "admin",
    "administrator",
    "administration",
    "管理员",
    "管理",
    "官方",
    "版主",
    "moderator",
    "moderateur",
    "modérateur",
    "official",
    "staff",
    "system",
    "系统",
    "atlas",
    "wsatlas",
    "wsatlasadmin",
    "warselection",
  ].map((name) => name.normalize("NFKC").toLowerCase().replace(/[_.\-\s]/g, "")),
);

function reservedKey(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[_.\-\s]/g, "");
}

/** Erreur du pseudo (clé i18n zh) ou undefined si valide. */
export function displayNameIssue(raw: string): string | undefined {
  const name = raw.trim();
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX)
    return "昵称长度需在 2 到 40 个字符之间。";
  if (/\s{2,}/.test(name) || /\t|\n|\r/.test(name))
    return "昵称中不能包含连续空格或不可见字符。";
  if (!DISPLAY_NAME_PATTERN.test(name)) return "昵称只能使用文字、数字、空格和 _ . - 符号。";
  if (RESERVED_DISPLAY_NAMES.has(reservedKey(name))) return "该昵称不可使用。";
  return undefined;
}

/**
 * Initiales de repli (aucun avatar) : première lettre du premier mot et du
 * dernier mot, en capitales — robuste pour le CJK (1 caractère = 1 mot visuel).
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0]!)[0]!;
  const last = Array.from(words[words.length - 1]!)[0]!;
  return words.length === 1 ? first.toUpperCase() : (first + last).toUpperCase();
}

// ---------------------------------------------------------------------------
// Avatars : validation défensive côté serveur. Un PNG/JPEG dont la structure
// ne peut pas être parcourue intégralement est refusé (jamais stocké tel
// quel), et les segments de métadonnées sont supprimés avant le stockage R2 —
// un EXIF (GPS, appareil…) ne peut ainsi pas être publié via l'endpoint.

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && PNG_SIGNATURE.every((v, i) => bytes[i] === v);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * JPEG : retire APP1..APP15 (EXIF, XMP, ICC…) et COM (commentaires) en
 * recopiant le reste ; le flux entropique après SOS est recopié tel quel.
 * Retourne null si la structure est invalide (désynchronisation, SOS absent).
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!isJpeg(bytes)) return null;
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1]!;
    if (marker === 0xff) return null; // bourrage invalide ici
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(bytes.subarray(i, i + 2)); // marqueurs autonomes
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      // SOS/EOI : fin de la structure analysable, le reste est recopié tel
      // quel (données d'image).
      chunks.push(bytes.subarray(i));
      return concat(chunks);
    }
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 2 || i + 2 + length > bytes.length) return null;
    const keep = !(marker >= 0xe1 && marker <= 0xef) && marker !== 0xfe;
    if (keep) chunks.push(bytes.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  return null; // ni SOS ni EOI rencontrés : JPEG invalide
}

/**
 * PNG : retire les chunks de métadonnées texte (tEXt/zTXt/iTXt) et EXIF
 * (eXIf) en recopiant les autres chunks avec leur CRC d'origine.
 * Retourne null si le parcours des chunks est incohérent.
 */
export function stripPngMetadata(bytes: Uint8Array): Uint8Array | null {
  if (!isPng(bytes)) return null;
  const dropped = new Set(["eXIf", "tEXt", "zTXt", "iTXt"]);
  const chunks: Uint8Array[] = [bytes.subarray(0, 8)]; // signature
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = (bytes[i]! << 24) | (bytes[i + 1]! << 16) | (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (length < 0 || i + 12 + length > bytes.length) return null;
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    if (!dropped.has(type)) chunks.push(bytes.subarray(i, i + 12 + length));
    i += 12 + length;
    if (type === "IEND") return i === bytes.length ? concat(chunks) : concat(chunks); // IEND atteint
  }
  return null; // IEND manquant : PNG invalide
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

export type AvatarInspection =
  | { type: "image/png" | "image/jpeg"; bytes: Uint8Array }
  | { error: string };

/**
 * Valide un avatar candidat : PNG ou JPEG ≤ 2 Mo, magic bytes, structure
 * parcourable. Les métadonnées (EXIF/texte) sont retirées des octets
 * retournés AVANT tout stockage — la neutralisation est effectuée côté
 * serveur, indépendamment de ce que le client a pu envoyer.
 */
export function inspectAvatar(bytes: Uint8Array): AvatarInspection {
  if (bytes.length === 0) return { error: "头像文件无效，请重新选择。" };
  if (bytes.length > AVATAR_MAX_BYTES) return { error: "头像不能超过 2 MB。" };
  if (isPng(bytes)) {
    const clean = stripPngMetadata(bytes);
    return clean ? { type: "image/png", bytes: clean } : { error: "头像文件无效，请重新选择。" };
  }
  if (isJpeg(bytes)) {
    const clean = stripJpegMetadata(bytes);
    return clean ? { type: "image/jpeg", bytes: clean } : { error: "头像文件无效，请重新选择。" };
  }
  return { error: "头像只接受 PNG 或 JPEG 图片。" };
}

/** Clé R2 d'un avatar : dérivée de l'userId, jamais du nom de fichier. */
export function avatarKeyFor(userId: string): string {
  return `avatars/${userId}/avatar`;
}

// ---------------------------------------------------------------------------
// Throttling du PATCH profil (SB1-d) : même table auth_attempts que l'auth.
// ≥ 10 modifications en < 1 min depuis un même compte → 429. Le budget borne
// les tentatives, réussies comme refusées (comme le budget signup).

export const PROFILE_PATCH_BUDGET = { limit: 10, windowMs: 60 * 1000 };

export function profileAttemptKey(userId: string): string {
  return `profile:${userId.slice(0, 64)}`;
}
