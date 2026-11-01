"use client";
/** Sections « transferts de ressources » de la page résultat — façon
 *  ws-stats.pl (tableaux denses, badges discrets), dans les classes .rp du
 *  design-system wsva. Deux blocs :
 *  - « Sent by » : total envoyé par joueur et par âge du donneur (nos 5
 *    buckets réels Stone/Bronze/Iron/IR1/IR2 — le médiéval est fusionné
 *    dans Iron) + badge de générosité ;
 *  - « Transactions (N) » : heure, donneur, montant avec icône de ressource,
 *    direction →, receveur, certitude (Very likely / Likely).
 *  Données : lib/replay/transfers.ts (inférence documentée — les replays ne
 *  contiennent pas d'événements de transfert directs). Section omise
 *  proprement si aucune transaction n'est détectée. */
import { useBilingual, useI18n } from "@/components/i18n";
import type { Player } from "@/lib/replay/structure";
import {
  TRANSFER_AGE_BUCKETS,
  type Generosity,
  type TransfersAnalysis,
  type TransferCertainty,
} from "@/lib/replay/transfers";
import { compactNumber, formatClock } from "@/lib/replay/wsva-view";

const RESOURCE_ICON = [
  "/wus-data/content/images/resource/0.png",
  "/wus-data/content/images/resource/1.png",
  "/wus-data/content/images/resource/2.png",
] as const;

const RESOURCE_TITLE = [
  { zh: "食物", en: "Food" },
  { zh: "木材", en: "Wood" },
  { zh: "铁矿", en: "Iron" },
] as const;

/** Phrase de titre traduisible (modèle ${n}) pour le montant par ressource. */
const AMOUNT_TITLE = [
  { zh: "食物转赠：${n}", en: "Food sent: ${n}" },
  { zh: "木材转赠：${n}", en: "Wood sent: ${n}" },
  { zh: "铁矿转赠：${n}", en: "Iron sent: ${n}" },
] as const;

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

const CERTAINTY_LABELS: Record<TransferCertainty, { zh: string; en: string }> = {
  veryLikely: { zh: "极有可能", en: "Very likely" },
  likely: { zh: "有可能", en: "Likely" },
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
  const fmt = (kUnits: number) => compactNumber(kUnits * 1000, locale);
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
            "回放数据不含直接的转账事件：以下捐赠由资源变动推断（同一 30 秒窗口内，接收方库存意外增加、给出方支出同步放大），金额按接收方实测。",
            "Replays carry no direct transfer events: donations below are inferred from resource moves (within one 30 s window, an unexplained stock gain on the receiver matched by a spending spike on a teammate); amounts are measured on the receiver side.",
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

      {/* Transactions — liste chronologique. */}
      <div className="table-scroll">
        <table className="units-table transfers-table">
          <caption className="table-caption">
            {l("交易记录（${n}）", "Transactions (${n})").replace(
              "${n}",
              String(transfers.events.length),
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">{l("时间", "Time")}</th>
              <th scope="col">{l("来自", "From")}</th>
              <th scope="col" className="cell-number">
                {l("数量", "Amount")}
              </th>
              <th scope="col" aria-label={l("方向", "Direction")}>→</th>
              <th scope="col">{l("去向", "To")}</th>
              <th scope="col">{l("确定性", "Certainty")}</th>
            </tr>
          </thead>
          <tbody>
            {transfers.events.map((event, index) => (
              <tr key={index}>
                <td className="cell-nowrap cell-mono">{formatClock(event.timeMs)}</td>
                <td className="cell-nowrap">{nameOf(event.fromPlayerId)}</td>
                <td className="cell-number cell-strong">
                  <span
                    className="value-pairs"
                    title={l(
                      AMOUNT_TITLE[event.resourceIndex].zh,
                      AMOUNT_TITLE[event.resourceIndex].en,
                    ).replace("${n}", Math.round(event.amount * 1000).toLocaleString())}
                  >
                    <img
                      className="icon icon-sm"
                      src={RESOURCE_ICON[event.resourceIndex]}
                      alt={l(
                        RESOURCE_TITLE[event.resourceIndex].zh,
                        RESOURCE_TITLE[event.resourceIndex].en,
                      )}
                      loading="lazy"
                    />
                    {fmt(event.amount)}
                  </span>
                </td>
                <td aria-hidden="true">→</td>
                <td className="cell-nowrap">{nameOf(event.toPlayerId)}</td>
                <td>
                  <span
                    className={`tag transfer-badge transfer-cert-${event.certainty}`}
                    title={l(
                      "依据：给出方同期支出覆盖捐赠的程度与相对优势",
                      "Based on: how much of the donation the teammate's same-window spending covers, and by how much it dominates",
                    )}
                  >
                    {l(CERTAINTY_LABELS[event.certainty].zh, CERTAINTY_LABELS[event.certainty].en)}
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
