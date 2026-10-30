import Link from "@/components/site-link";
import { T } from "@/components/i18n";
import type { CreationCounts } from "@/lib/account-server";

// Section « mes créations » du hub /account (SB3). Rendu 100 % serveur : les
// compteurs viennent de lib/account-server.ts (mêmes requêtes que les API
// /api/atlas/submissions et /api/mods/submissions), aucun état client.

// Statuts dans l'ordre d'affichage ; libellés zh = clés i18n existantes du
// tableau de bord des soumissions (aucune nouvelle terminologie).
const STATUS_LABELS: ReadonlyArray<[string, string]> = [
  ["pending", "待审核"],
  ["approved", "已发布"],
  ["rejected", "需修改 / 下架"],
  ["withdrawn", "已撤回"],
];

function CountColumn({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}) {
  let total = 0;
  for (const value of Object.values(counts)) total += value;
  return (
    <div className="hub-type">
      <h3>
        <T text={title} />
        <span className="hub-total">{total}</span>
      </h3>
      <ul className="hub-counts">
        {STATUS_LABELS.map(([status, label]) => (
          <li key={status}>
            <strong>{counts[status] || 0}</strong>
            <span>
              <T text={label} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreationHub({ counts }: { counts: CreationCounts }) {
  const total =
    Object.values(counts.maps).reduce((a, b) => a + b, 0) +
    Object.values(counts.mods).reduce((a, b) => a + b, 0);
  return (
    <section className="panel creation-hub">
      <h2>
        <T text="我的创作" />
      </h2>
      <p className="meta muted">
        <T text="你的地图与 Mod 的当前审核状态一览。" />
      </p>
      <div className="hub-grid">
        <CountColumn title="地图" counts={counts.maps} />
        <CountColumn title="Mod" counts={counts.mods} />
      </div>
      {total === 0 && (
        <p className="meta muted">
          <T text="还没有创作记录，点击“提交地图”开始第一次投稿。" />
        </p>
      )}
      <div className="review-buttons">
        <Link className="button primary" href="/submit">
          <T text="提交地图" />
        </Link>
        <Link className="button" href="/submit/mod">
          <T text="提交 Mod" />
        </Link>
        <Link className="button" href="/submissions">
          <T text="查看我的创作" />
        </Link>
      </div>
    </section>
  );
}
