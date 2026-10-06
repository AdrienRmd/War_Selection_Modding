import { T } from "@/components/i18n";
import { LocalizedImage } from "@/components/localized-media";
import { listCreators, type Creator } from "@/lib/creators-server";
function initials(name: string) {
  const clean = name.trim();
  return clean ? clean.slice(0, 2) : "?";
}
function CreatorAvatar({ c }: { c: Creator }) {
  return c.has_photo ? (
    <LocalizedImage
      className="creator-avatar"
      src={`/api/creators/${c.id}`}
      alt={c.name}
      loading="lazy"
      width={96}
      height={96}
    />
  ) : (
    <span className="creator-avatar creator-initial" aria-hidden="true">
      {initials(c.name)}
    </span>
  );
}
export async function CreatorsBanner() {
  let creators: Creator[];
  try {
    creators = await listCreators();
  } catch {
    return null;
  }
  if (!creators.length) return null;
  return (
    <section className="creators-banner">
      <div className="creators-head">
        <p className="eyebrow">
          <T text="THE CREW" />
        </p>
        <h2>
          <T text={"网站创作者"} />
        </h2>
        <p>
          <T text={"他们搭建并维护这个社区。"} />
        </p>
      </div>
      <ul className="creators-row">
        {creators.map((c) => (
          <li className="creator-card" key={c.id}>
            <CreatorAvatar c={c} />
            <strong>{c.name}</strong>
            {c.role && <small>{c.role}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
