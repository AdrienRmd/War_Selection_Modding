"use client";
/** Section « transferts de ressources » de la page résultat — façon
 *  ws-stats.pl (tableau dense, badges discrets), dans les classes .rp du
 *  design-system wsva. Récapitulatif « Sent by » seul depuis la v2 (02/11) :
 *  la liste détaillée des transactions n'est plus affichée — l'inférence
 *  reste calculée en lib (montants, certitudes) pour alimenter le récap.
 *  - « Sent by » : total envoyé par joueur et par âge du donneur (nos 5
 *    buckets réels Stone/Bronze/Iron/IR1/IR2 — le médiéval est fusionné
 *    dans Iron) + badge de générosité ;
 *  Montants en RESSOURCES DU JEU (unités réelles — cf. v2 : les « M » de
 *  la v1 étaient un artefact d'échelle ×1000).
 *  Données : lib/replay/transfers.ts (inférence documentée — les replays ne
 *  contiennent pas d'événements de transfert directs). Section omise
 *  proprement si aucune transaction n'est détectée. */
import { useBilingual, useI18n } from "@/components/i18n";
import type { Player } from "@/lib/replay/structure";
import { TRANSFER_AGE_BUCKETS, type Generosity, type TransfersAnalysis } from "@/lib/replay/transfers";
import { compactNumber } from "@/lib/replay/wsva-view";

const AGE_LABELS: Record<(typeof TRANSFER_AGE_BUCKETS)[number], { zh: string; en: string }> = {
  stone: { zh: "石器", en: "Stone" },
  bronze: { zh: "青铜", en: "Bronze" },
  iron: { zh: "铁器（含中世纪）", en: "Iron (incl. Medieval)" },
  ir1: { zh: "工业一期", en: "Industrial 1" },
  ir2: { zh: "工业二期", en: "Industrial 2" },
};

const GENEROSITY_LABELS: Record<Generosity, { zh: string; en: string }> = {
  veryGenerous: { zh: "慷慨大方", en: "Very generous" },
  fair: { zh: "一般", en: "Fair" },
  small: { zh: "少量", en: "Small" },
};

export function TransfersPanel({
  transfers,
  players,
}: {
  transfers: TransfersAnalysis;
  players: Player[];
}) {
  const l = useBilingual();
  const { locale } = useI18n();
  const fmt = (resources: number) => compactNumber(resources, locale);
  const nameOf = (id: number) => players[id]?.nickname ?? `#${id}`;

  return (
    <section className="panel transfers-panel" aria-label={l("资源转赠", "Resource transfers")}>
      <header className="transfers-heading">
        <h2 className="heading-2 insight-heading">
          <img className="icon icon-md" src="/icons/coins.png" alt="" aria-hidden="true" />
          {l("资源转赠", "Resource transfers")}
        </h2>
        <p className="label-text">
          {l(
            "回放不含直接的转账事件：以下金额由资源变动推断（同一 30 秒窗口内，接收方库存意外增加、且队友支出出现相应跳升），按接收方实测，单位为游戏资源；无法归到具体队友的变动不计入。",
            "Replays carry no direct transfer events: totals below are inferred from resource moves (within one 30 s window, an unexplained stock gain on the receiver matched by a spending jump on a teammate); amounts are measured on the receiver side, in game resources; moves that cannot be pinned to a teammate are excluded.",
          )}
        </p>
      </header>

      {/* Sent by — par joueur et par âge du donneur. */}
      <div className="table-scroll">
        <table className="units-table transfers-table">
          <caption className="table-caption">
            {l("按玩家统计（共送出 ${n} 笔）", "Sent by (${n} transactions)")
              .replace("${n}", String(transfers.events.length))}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l("玩家", "Player")}</th>
              {TRANSFER_AGE_BUCKETS.map((bucket) => (
                <th key={bucket} scope="col" className="cell-number">
                  {l(AGE_LABELS[bucket].zh, AGE_LABELS[bucket].en)}
                </th>
              ))}
              <th scope="col" className="cell-number">
                {l("总计", "Total")}
              </th>
              <th scope="col">{l("慷慨度", "Generosity")}</th>
            </tr>
          </thead>
          <tbody>
            {transfers.sentBy.map((row) => (
              <tr key={row.playerId}>
                <td className="cell-nowrap">{nameOf(row.playerId)}</td>
                {TRANSFER_AGE_BUCKETS.map((bucket) => (
                  <td key={bucket} className="cell-number">
                    {row.byAge[bucket] > 0 ? fmt(row.byAge[bucket]) : <span className="hint-term-value">–</span>}
                  </td>
                ))}
                <td className="cell-number cell-strong">{fmt(row.total)}</td>
                <td>
                  <span
                    className={`tag transfer-badge transfer-gen-${row.generosity}`}
                    title={l("按总送出量评定", "Graded by total resources sent")}
                  >
                    {l(
                      GENEROSITY_LABELS[row.generosity].zh,
                      GENEROSITY_LABELS[row.generosity].en,
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
