import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import type { Metadata } from "next";
import { pageMetadata, requestLocale } from "@/lib/page-metadata";
import "../methodology.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("methodology");
}

/** Page /methodologie — « Comment sont calculées les statistiques de
 *  replay ». Chaque affirmation décrit CE QUE LE CODE FAIT (sources :
 *  lib/replay/score.ts, parser.ts, analysis.ts, medals.ts, population.ts,
 *  kill-death.ts, replay-stats.ts — constantes et conditions reprises
 *  telles qu'implémentées, aucune approximation de marketing). */
export default async function MethodologyPage() {
  return (
    <>
      <AtlasHeader />
      <main className="shell methodology-page">
        <h1>
          <T text="回放统计是怎么算的？" />
        </h1>
        <p className="methodology-lead label-text">
          <T text="本页逐项说明回放页与排行榜上每个数字的来源：哪些是精确值，哪些是估算，公式与权重原样来自代码。统计基于游戏官方回放接口的数据；我们的模型（胜负概率、人口估算等）凡有近似处都明确标注。" />
        </p>

        {/* ---------------- Score MVP ---------------- */}
        <section aria-labelledby="mvp-title">
          <h2 id="mvp-title">
            <T text="MVP 分数与 MVP 称号" />
          </h2>
          <p>
            <T text="MVP 分数由三组加分构成，全部来自回放时间线（每 30 秒一帧）：" />
          </p>
          <dl className="methodology-dl">
            <div>
              <dt>
                <T text="直接分（战斗）" />
              </dt>
              <dd>
                <T text="消灭玩家积分：击杀敌方玩家时，按受害者的 MVP 分、击杀者占全队的军队/分数份额与击杀次序折算（越晚越低；开局 4 分钟内退出不计）；战斗分 = √(击杀点数曲线下面积) × 1.2；单位击杀分 = Σ(单位击杀点 × 数量) × 0.8。" />
              </dd>
            </div>
            <div>
              <dt>
                <T text="间接分（经济与领土）" />
              </dt>
              <dd>
                <T text="领土分 = 领土点数总和 × 0.000025，乘以随存活时间衰减的系数；经济分 = 平均资源消耗 × 0.25，乘以同款系数的五次方（长期存活者收益递增）。" />
              </dd>
            </div>
            <div>
              <dt>
                <T text="加成分" />
              </dt>
              <dd>
                <T text="军队规模平均值 × 0.2；每项研究 +1 分；奇观分：建造奇观 +150，胜利奇观 +250，全场首座奇观最高 600 分并随时间指数衰减（参考点 26.5 分钟）。总分乘以队伍系数（胜方 1.07），再按比赛时长折算（×1000 ÷ 秒数）。" />
              </dd>
            </div>
          </dl>
          <p>
            <T text="一局的 MVP 是 MVP 分数最高的玩家（代码逐个比较取最大），获得金质「战争冠军」奖章；表格中的「影响力 %」= 该玩家 MVP 分 ÷ 全队 MVP 分之和。" />
          </p>
        </section>

        {/* ---------------- Population ---------------- */}
        <section aria-labelledby="pop-title">
          <h2 id="pop-title">
            <T text="人口曲线（估算）" />
          </h2>
          <p>
            <T text="官方回放接口没有「存活单位数」这个字段，所以人口曲线是一项文档化的估算，由两部分组成：" />
          </p>
          <ul>
            <li>
              <T text="经济人口（逐帧精确）：回放按 30 秒一帧记录每方的村民、渔船与拖拉机数量，按各自人口成本（1 / 2 / 3）求和；不同时代的成本差异最多影响 1 点/单位。" />
            </li>
            <li>
              <T text="军队人口（估算）：军队(t) = R × 当前军队点数(t)，其中 R = Σ(该玩家生产单位数 × 人口成本，不含村民) ÷ Σ(生产单位贡献的军队点数)。曲线形状来自游戏逐帧的真实军队点数，只有比例是按该玩家全部生产内容校准的常数——军队构成随时间变化时会带来误差。被淘汰后曲线回落到 0（游戏清零该方数据；个别帧可能残留少量幸存单位）。" />
            </li>
          </ul>
          <p className="label-text">
            <T text="纵轴默认 0–600（游戏常规上限），超出时自动扩展。" />
          </p>
        </section>

        {/* ---------------- Armée max ---------------- */}
        <section aria-labelledby="army-title">
          <h2 id="army-title">
            <T text="「最大军队（点）」" />
          </h2>
          <p>
            <T text="这是游戏自己的军队价值（点数）曲线的峰值——该曲线是一个随时间升降的存量（单位死亡时下降），不是存活单位个数：回放时间线里根本没有这个字段，所以我们用游戏原生点数并如实标注单位。" />
          </p>
        </section>

        {/* ---------------- K/D ---------------- */}
        <section aria-labelledby="kd-title">
          <h2 id="kd-title">
            <T text="K/D、生产 / 歼灭 / 损失" />
          </h2>
          <p>
            <T text="生产、歼灭、损失是回放附带的逐单位计数（玩家统计表按类别列出）。K/D = 单位击杀数 ÷ 单位损失数；没有损失时直接等于击杀数；旧回放缺少击杀/损失数据时显示「–」。还有一个隐藏的「价值 K/D」（按每单位战斗价值加权），用于奖章判定。" />
          </p>
        </section>

        {/* ---------------- Médailles ---------------- */}
        <section aria-labelledby="medals-title">
          <h2 id="medals-title">
            <T text="奖章（10 种 · 金/银/木）" />
          </h2>
          <p className="label-text">
            <T text="每局结束后自动颁发，条件如下（与代码一致）：" />
          </p>
          <table className="methodology-table">
            <thead>
              <tr>
                <th scope="col">
                  <T text="奖章" />
                </th>
                <th scope="col">
                  <T text="等级" />
                </th>
                <th scope="col">
                  <T text="条件" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-champion-of-the-war.png" alt="" aria-hidden="true" loading="lazy" /><T text="战争冠军" /></td>
                <td className="cell-mono"><T text="金" /></td>
                <td><T text="奖章条件：本局 MVP（影响力份额最高的玩家）。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-first-blade.png" alt="" aria-hidden="true" loading="lazy" /><T text="第一把利刃" /></td>
                <td className="cell-mono"><T text="银" /></td>
                <td><T text="奖章条件：完成全场第一次真正淘汰（主动退出不计）的击杀者。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-first-to-fall.png" alt="" aria-hidden="true" loading="lazy" /><T text="最先倒下" /></td>
                <td className="cell-mono"><T text="木" /></td>
                <td><T text="奖章条件：全场第一个被淘汰的玩家（含主动退出）。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-master-of-coin.png" alt="" aria-hidden="true" loading="lazy" /><T text="钱币大师" /></td>
                <td className="cell-mono"><T text="银" /></td>
                <td><T text="奖章条件：全场采集资源总量最高的玩家。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-in-total-control.png" alt="" aria-hidden="true" loading="lazy" /><T text="全面掌控" /></td>
                <td className="cell-mono"><T text="金" /></td>
                <td><T text="奖章条件：某一时刻占有本队领土 ≥ 50%（每局至多一次）。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-cannon-fodder.png" alt="" aria-hidden="true" loading="lazy" /><T text="炮灰" /></td>
                <td className="cell-mono"><T text="木" /></td>
                <td><T text="奖章条件：损失 ≥ 15 个单位且 K/D < 1。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-deserter.png" alt="" aria-hidden="true" loading="lazy" /><T text="逃兵" /></td>
                <td className="cell-mono"><T text="木" /></td>
                <td><T text="奖章条件：属于某个小队时主动退出对局。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-ghost.png" alt="" aria-hidden="true" loading="lazy" /><T text="幽灵" /></td>
                <td className="cell-mono"><T text="木" /></td>
                <td><T text="奖章条件：不属于任何小队时主动退出对局。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-farmer.png" alt="" aria-hidden="true" loading="lazy" /><T text="农夫" /></td>
                <td className="cell-mono"><T text="木" /></td>
                <td><T text="奖章条件：采集 ≥ 5000 资源且每千资源击杀 < 0.5。" /></td>
              </tr>
              <tr>
                <td><img className="icon icon-sm" src="/icons/medal-last-stand.png" alt="" aria-hidden="true" loading="lazy" /><T text="最后的坚守" /></td>
                <td className="cell-mono"><T text="银" /></td>
                <td><T text="奖章条件：败方最后一名被淘汰者，且比倒数第二名晚至少 5 分钟。" /></td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ---------------- Power / win chance ---------------- */}
        <section aria-labelledby="power-title">
          <h2 id="power-title">
            <T text="力量对比与胜率（近似模型）" />
          </h2>
          <p>
            <T text="「力量对比」图是标注过版本号的近似模型（v1）：每帧的力量 = 军队、收入、领土三份占比的平均——军队 = 存活军队点数（累计生产点数 − 0.7 × 被击杀点数），收入 = 约 5 分钟滚动平均的资源采集，领土 = 当前领地。胜率曲线 = 以 20 为斜率的 S 型函数，作用于约 10 分钟指数平滑后的力量差；仅按已知胜方做过定性校准。分页上的「决定性事件」也由此模型推导。" />
          </p>
        </section>

        {/* ---------------- Classement ---------------- */}
        <section aria-labelledby="ladder-title">
          <h2 id="ladder-title">
            <T text="玩家排行榜" />
          </h2>
          <p>
            <T text="积分 = 参赛场次 + 胜场 × 2 + MVP × 2 + ⌊总击杀 ÷ 100⌋。赛季按比赛开始时间（游戏数据）取年-月；按队伍规模分两组：大部队（3v3 及以上）与单/双人。数据来自所有已公开回放：玩家手动提交（人工审核）与夜间自动采集（发现自 ws-stats.pl 的公开索引）——该索引只覆盖 ws-stats 已知的对局，未必是全部，榜单反映的是被收录的范围。" />
          </p>
        </section>

        <p className="methodology-more label-text">
          <T text="想看一局的实际数字？" />{" "}
          <Link className="name-link" href="/replay">
            <T text="打开回放分析" />
          </Link>
        </p>
      </main>
      <AtlasFooter />
    </>
  );
}
