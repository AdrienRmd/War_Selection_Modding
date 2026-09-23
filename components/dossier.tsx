"use client";
import { T, useI18n } from "@/components/i18n";

import { useEffect, useState } from "react";
import Link from "@/components/site-link";
import {
  Search,
  ArrowUpRight,
  AlertTriangle,
  Shield,
  Flag,
  Factory,
  Plane,
  Users,
  Check,
  Download,
  BookOpen,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { mods, units, heroes, proposals } from "@/lib/stalingrad";
const tabKeys = ["overview", "mods", "balance", "economy", "roadmap"];
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export function Status({ value }: { value: string }) {
  const type = ["保留方案", "approved"].includes(value)
    ? "retained"
    : ["暂停", "弃用", "rejected", "withdrawn"].includes(value)
      ? "paused"
      : ["待修复验收", "待核对"].includes(value)
        ? "repair"
        : "testing";
  const labels: Record<string, string> = {
    approved: "已发布",
    pending: "待审核",
    rejected: "需修改 / 已下架",
    withdrawn: "已撤回",
  };
  return (
    <span className={`status ${type}`}>
      <T text={labels[value] || value} />
    </span>
  );
}
function StatsTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((h) => (
            <TableHead key={h}>
              <T text={h} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((v, j) => (
              <TableCell key={j}>
                <T text={v} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
export function Dossier({ technicalOnly = false }: { technicalOnly?: boolean }) {
  const { t } = useI18n();
  const [tab, setTab] = useState(technicalOnly ? "balance" : "overview"),
    [filter, setFilter] = useState("全部"),
    [query, setQuery] = useState(""),
    [group, setGroup] = useState("步兵与车辆");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (technicalOnly && t === "mods") {
      window.location.replace("/mods?map=stalingrad");
      return;
    }
    if (t && tabKeys.includes(t) && (!technicalOnly || !["overview", "mods"].includes(t)))
      void Promise.resolve().then(() => setTab(t));
  }, [technicalOnly]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool: Tool = {
      name: "read_stalingrad_configuration",
      title: "查询斯大林格勒配置",
      description:
        "读取本站整理的当前代码配置，按 Mod 状态或单位 ID 查询。不会修改地图、投稿或发布状态。",
      inputSchema: {
        type: "object",
        properties: {
          unitIds: { type: "array", items: { type: "integer" }, maxItems: 40 },
          status: {
            type: "string",
            enum: ["全部", ...Array.from(new Set(mods.map((m) => m.status)))],
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input))
          throw new Error("Expected object");
        const i = input as { unitIds?: number[]; status?: string };
        if (
          Object.keys(i).some((k) => !["unitIds", "status"].includes(k)) ||
          (i.unitIds &&
            (!Array.isArray(i.unitIds) ||
              i.unitIds.length > 40 ||
              i.unitIds.some((n) => !Number.isInteger(n)))) ||
          (i.status && !["全部", ...mods.map((m) => m.status)].includes(i.status))
        )
          throw new Error("Invalid filter");
        return {
          asOf: "2026-09-09",
          scope: "本地代码，不等于已实机验收",
          mods: mods.filter((m) => !i.status || i.status === "全部" || m.status === i.status),
          units: i.unitIds ? units.filter((u) => i.unitIds!.includes(u.id)) : [],
        };
      },
    };
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const visibleMods = mods.filter(
    (m) =>
      (filter === "全部" || m.status === filter) &&
      `${m.name} ${t(m.name)} ${m.file} ${m.description} ${t(m.description)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const visibleUnits = units.filter(
    (u) =>
      u.group === group &&
      `${u.id} ${u.name} ${t(u.name)}`.toLowerCase().includes(query.toLowerCase()),
  );
  function changeTab(v: string) {
    setTab(v);
    setQuery("");
    window.history.replaceState(null, "", `?tab=${v}#dossier`);
  }
  return (
    <div id="dossier">
      <div className="notice">
        <AlertTriangle size={19} />
        <p>
          <strong>
            <T text={"历史技术快照 · 2026.09.09"} />
          </strong>{" "}
          <T
            text={
              "以下数值依据当时本地代码整理，与上方作者维护资料分开。保留方案不等于已挂载或实机验收；修改网页说明不会自动修改游戏。"
            }
          />
        </p>
      </div>
      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList variant="line" className="archive-tabs dossier-tabs">
          {[
            ["overview", "战场概览"],
            ["mods", "Mod 清单"],
            ["balance", "平衡数值"],
            ["economy", "经济与后期"],
            ["roadmap", "改进与测试"],
          ]
            .filter(([v]) => !technicalOnly || !["overview", "mods"].includes(v))
            .map(([v, n]) => (
              <TabsTrigger value={v} key={v}>
                <T text={n} />
              </TabsTrigger>
            ))}
        </TabsList>
        <TabsContent value="overview">
          <div className="overview-grid">
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="eyebrow">
                    <T text="TACTICAL OVERVIEW" />
                  </p>
                  <h2>
                    <T text={"一条河，三座城区。"} />
                  </h2>
                </div>
                <Flag size={25} />
              </div>
              <img
                className="tactical-map"
                src="/stalingrad-map.png"
                alt={t("作者留存的斯大林格勒地图俯视图，城区位于河流西侧，东侧分布支流与林地")}
              />
              <p className="caption">
                <T text={"作者留存地图缩略图 · 不是实时战况或最新版边界保证"} />
              </p>
              <div className="sector-grid">
                {["南城区", "中心城区", "北城区"].map((n, i) => (
                  <div key={n}>
                    <span className="sector-number">
                      0<T text={i + 1} />
                    </span>
                    <h3>
                      <T text={n} />
                    </h3>
                    <p>
                      <T text={"每处占领收益相同"} />
                    </p>
                  </div>
                ))}
              </div>
              <div className="rule-line">
                <b>
                  <T text={"05 秒"} />
                </b>
                <span>
                  <T text={"检查一次归属；双方争夺或无人时，归属保持不变。"} />
                </span>
              </div>
              <div className="rule-line">
                <b>
                  <T text={"120 秒"} />
                </b>
                <span>
                  <T text={"每处据点向占领方各位置发放 500 肉 / 木 / 铁，易手重新计时。"} />
                </span>
              </div>
              <p className="meta muted">
                <T text={"占领会在聊天框中英提示。目前尚无定时三城区归属汇总。"} />
              </p>
            </section>
            <aside className="detail-aside">
              <section className="panel">
                <p className="eyebrow">
                  <T text="MATCH SETUP" />
                </p>
                <h2>
                  <T text={"战场规则"} />
                </h2>
                <dl className="key-values">
                  <div>
                    <dt>
                      <T text={"阵营规模"} />
                    </dt>
                    <dd>15 vs 15</dd>
                  </div>
                  <div>
                    <dt>
                      <T text={"大学造价"} />
                    </dt>
                    <dd>3000 / 2000 / 500</dd>
                  </div>
                  <div>
                    <dt>
                      <T text={"大学条件"} />
                    </dt>
                    <dd>
                      <T text={"20 名工人 · 最多 3 座"} />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <T text={"工业二条件"} />
                    </dt>
                    <dd>
                      <T text={"至少 40 名工人 201"} />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <T text={"英雄限额"} />
                    </dt>
                    <dd>
                      <T text={"每种 1 名 · 待验收"} />
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <T text={"工业工人"} />
                    </dt>
                    <dd>
                      <T text={"201 生产入口限 60 · 待测"} />
                    </dd>
                  </div>
                </dl>
                <p className="caption">
                  <T text={"资源顺序均为肉 / 木 / 铁。工人限制不等于所有农民总数的硬上限。"} />
                </p>
              </section>
              <section className="panel">
                <p className="eyebrow">
                  <T text="NATIONS & POSITIONS" />
                </p>
                <h2>
                  <T text={"国家分配"} />
                </h2>
                <StatsTable
                  headers={["国家", "位置"]}
                  rows={[
                    ["德国", "01–10"],
                    ["苏联", "11–20"],
                    ["波兰", "21–25"],
                    ["奥匈", "26–28"],
                    ["意大利", "29–30"],
                  ]}
                />
                <p className="caption">
                  <T text={"所有位置仍可选择常规国家。开局初始化时代路径，不是全员直接工二。"} />
                </p>
              </section>
            </aside>
          </div>
          <div className="notice subtle">
            <BookOpen size={20} />
            <p>
              <T
                text={
                  "1942 年，伏尔加河畔的工业重镇成为东线战场焦点。本图以城区争夺、装甲推进与大规模协作为核心。封面为历史氛围插画，并非游戏画面。"
                }
              />
            </p>
          </div>
        </TabsContent>
        <TabsContent value="mods">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <T text="MOD MANIFEST" />
              </p>
              <h2>
                <T text={"规则，不再藏在一堆说明里。"} />
              </h2>
            </div>
            <span className="meta muted">
              <T text={"17 个归档条目 · G 玩法 / V 视觉"} />
            </span>
          </div>
          <div className="toolbar">
            <div className="search-input">
              <Search size={18} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("搜索 Mod、文件名或功能…")}
                aria-label={t("搜索 Mod")}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger aria-label={t("筛选 Mod 状态")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["全部", ...Array.from(new Set(mods.map((m) => m.status)))].map((s) => (
                  <SelectItem key={s} value={s}>
                    <T text={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="meta muted">
              <T text={visibleMods.length} /> <T text={"项"} />
            </span>
          </div>
          <div className="mod-grid">
            {visibleMods.map((m, i) => (
              <article className="mod-card" key={m.file}>
                <div className="mod-card-head">
                  <span className="mod-index">
                    <T text={String(i + 1).padStart(2, "0")} /> / <T text={m.kind} />
                  </span>
                  <Status value={m.status} />
                </div>
                <h3>
                  <T text={m.name} />
                </h3>
                <p>
                  <T text={m.description} />
                </p>
                <details>
                  <summary>
                    <T text={"查看实施边界"} />
                  </summary>
                  <p>
                    <T text={m.note} />
                  </p>
                  <code>
                    <T text={m.file} />
                  </code>
                </details>
              </article>
            ))}
          </div>
          {!visibleMods.length && (
            <p className="notice">
              <T text={"没有匹配的 Mod，试试其他关键词或状态。"} />
            </p>
          )}
          <div className="notice">
            <Shield size={20} />
            <p>
              <T
                text={
                  "加载关系：平衡 → 英雄 → 后期；英雄玩法与视觉必须配对。经济与旧 Storage 二选一。冬将军、227、旧 territory 与自定义伞兵不计入当前正式保留方案。"
                }
              />
            </p>
          </div>
        </TabsContent>
        <TabsContent value="balance">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <T text="UNIT BALANCE / CURRENT CODE" />
              </p>
              <h2>
                <T text={"火力有刻度，定位有区别。"} />
              </h2>
            </div>
            <Link className="text-link" href="/reference">
              <T text={"完整护甲、海军与支援明细"} /> <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="toolbar">
            <Select
              value={group}
              onValueChange={(v) => {
                setGroup(v);
                setQuery("");
              }}
            >
              <SelectTrigger aria-label={t("单位分类")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["步兵与车辆", "防空", "飞机"].map((s) => (
                  <SelectItem value={s} key={s}>
                    <T text={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="search-input">
              <Search size={18} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("输入单位 ID 或名称…")}
                aria-label={t("搜索单位")}
              />
            </div>
          </div>
          <div className="data-table">
            <StatsTable
              headers={[
                "ID",
                "单位 / 定位",
                "血量",
                "单次基础伤害",
                "装填 / 秒",
                "最大射程",
                "补充说明",
              ]}
              rows={visibleUnits.map((u) => [
                u.id,
                u.name,
                u.hp,
                u.damage,
                u.reload,
                u.range,
                u.note,
              ])}
            />
          </div>
          {!visibleUnits.length && (
            <p className="notice">
              <T text={"没有找到对应单位。"} />
            </p>
          )}
          <p className="caption">
            <T
              text={
                "“继承”代表该字段没有在此 Mod 赋值，不代表为零。装填不是完整实测攻击周期；多发动作、护甲与目标标签会影响输出，不能直接当作 DPS。定位名称不保证游戏内已更名。"
              }
            />
          </p>
          <div className="info-grid">
            <div className="panel">
              <Plane />
              <h3>
                <T text={"飞机更强，出动也有代价。"} />
              </h3>
              <p>
                <T
                  text={
                    "8 种飞机油箱扩容，加油速度约为首次基准的 75%。444/448 保持原版护甲；自定义坠机伤害与追踪已删除。补给时间仍需实测。"
                  }
                />
              </p>
            </div>
            <div className="panel">
              <Shield />
              <h3>
                <T text={"防空加强，不等于平射无敌。"} />
              </h3>
              <p>
                <T
                  text={
                    "310、317–321 主防空武器最小射程为 30。专用伤害标签仍可能覆盖基础值；对空伤害不代表对所有地面目标同样有效。"
                  }
                />
              </p>
            </div>
          </div>
          <section className="heroes-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  <T text="LEGENDARY UNITS" />
                </p>
                <h2>
                  <T text={"大学传奇英雄"} />
                </h2>
              </div>
              <Status value="待修复验收" />
            </div>
            <p className="muted">
              <T
                text={
                  "每种限 1 名，训练均为 10 分钟。常规国家英雄尚未实现；当前代码仍缺显式工二门槛。"
                }
              />
            </p>
            <div className="hero-grid">
              {heroes.map((h, i) => (
                <article className="hero-card" key={h.name}>
                  <div className="hero-monogram">
                    <span>
                      <T text="ACE / 0" />
                      <T text={i + 1} />
                    </span>
                    <Shield size={45} />
                    <small>
                      <T text={h.sub} />
                    </small>
                  </div>
                  <div className="hero-card-content">
                    <small>
                      <T text={h.side} />
                    </small>
                    <h3>
                      <T text={h.name} />
                    </h3>
                    <dl>
                      <div>
                        <dt>
                          <T text={"血量"} />
                        </dt>
                        <dd>
                          <T text={h.hp} />
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <T text={"伤害"} />
                        </dt>
                        <dd>
                          <T text={h.damage} />
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <T text={"装填"} />
                        </dt>
                        <dd>
                          <T text={h.reload} />
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <T text={"人口"} />
                        </dt>
                        <dd>
                          <T text={h.pop} />
                        </dd>
                      </div>
                    </dl>
                    <p className="hero-cost">
                      <T text={h.cost} />
                      <small>
                        <T text={"肉 / 木 / 铁"} />
                      </small>
                    </p>
                    <p>
                      <T text={h.note} />
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="economy">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                  <T text="ECONOMY & LATE GAME" />
                </p>
              <h2>
                <T text={"减少农民，不缩小战场。"} />
              </h2>
            </div>
            <Status value="待测试" />
          </div>
          <div className="economy-metrics">
            <article>
              <Users />
              <strong>
                60
                <small>
                  <T text={"名"} />
                </small>
              </strong>
              <h3>
                <T text={"工业工人 201 生产限制"} />
              </h3>
              <p>
                <T text={"不合并旧时代农民，不删除已存在的超额工人；并行队列待验证。"} />
              </p>
            </article>
            <article>
              <Factory />
              <strong>×2</strong>
              <h3>
                <T text={"正值交资源效率"} />
              </h3>
              <p>
                <T
                  text={"按首次基准翻倍：原 150% → 300%，不是统一设为 200%，也不是直接加采集速度。"}
                />
              </p>
            </article>
            <article>
              <Flag />
              <strong>
                +10<small>%</small>
              </strong>
              <h3>
                <T text={"奇迹地面基础武器伤害"} />
              </h3>
              <p>
                <T text={"仅研究完成的本方符合筛选地面军事单位，不是整个同盟或高频全军光环。"} />
              </p>
            </article>
          </div>
          <div className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">
                  <T text="PASSIVE RESOURCE INCOME" />
                </p>
                <h2>
                  <T text={"让后期，有能力再打一次。"} />
                </h2>
              </div>
              <span className="meta muted">
                <T text={"每分钟基础收入 / 肉 · 木 · 铁"} />
              </span>
            </div>
            {[
              { name: "普通矿场 253", values: [240, 240, 480], max: 1200 },
              { name: "升级矿场 281", values: [480, 480, 960], max: 1200 },
              { name: "工业奇迹 239", values: [1200, 1200, 1200], max: 1200 },
            ].map((m) => (
              <div className="income-row" key={m.name}>
                <h3>
                  <T text={m.name} />
                </h3>
                <div>
                  {m.values.map((v, i) => (
                    <div className="income-bar" key={i}>
                      <span>
                        <T text={["肉", "木", "铁"][i]} />
                      </span>
                      <div>
                        <i style={{ width: `${(v / m.max) * 100}%` }} />
                      </div>
                      <b>
                        <T text={v} />
                      </b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="caption">
              <T text={"基础设定值，不含其他科技、仓库或引擎可能的结算修正；并非已测净收入。"} />
            </p>
          </div>
          <div className="info-grid">
            <section className="panel">
              <h3>
                <T text={"矿场升级"} />
              </h3>
              <dl className="key-values">
                <div>
                  <dt>
                    <T text={"需要时代"} />
                  </dt>
                  <dd>
                    <T text={"六国对应工业二"} />
                  </dd>
                </div>
                <div>
                  <dt>
                    <T text={"升级费用"} />
                  </dt>
                  <dd>3000 / 2000 / 1000</dd>
                </div>
                <div>
                  <dt>
                    <T text={"升级时间"} />
                  </dt>
                  <dd>
                    <T text={"90 秒"} />
                  </dd>
                </div>
                <div>
                  <dt>
                    <T text={"收入结算"} />
                  </dt>
                  <dd>
                    <T text={"每 5 秒，升级后翻倍"} />
                  </dd>
                </div>
              </dl>
              <p className="muted">
                <T text={"矿场原建造费不改；没有新增矿场数量上限，需观察后期铺矿与资源膨胀。"} />
              </p>
            </section>
            <section className="panel">
              <h3>
                <T text={"工业奇迹"} />
              </h3>
              <dl className="key-values">
                <div>
                  <dt>
                    <T text={"研究造价"} />
                  </dt>
                  <dd>15000 / 12000 / 8000</dd>
                </div>
                <div>
                  <dt>
                    <T text={"收入结算"} />
                  </dt>
                  <dd>
                    <T text={"每 10 秒，各资源 200"} />
                  </dd>
                </div>
                <div>
                  <dt>
                    <T text={"建筑被毁"} />
                  </dt>
                  <dd>
                    <T text={"停止收入，军事研究保留"} />
                  </dd>
                </div>
                <div>
                  <dt>
                    <T text={"核弹价格"} />
                  </dt>
                  <dd>
                    <T text={"由作者在游戏内配置"} />
                  </dd>
                </div>
              </dl>
              <p className="muted">
                <T
                  text={
                    "研究保留原有时间和前置。伤害强化排除建筑、工人、空军、海军，不额外增加弹丸。"
                  }
                />
              </p>
            </section>
          </div>
          <div className="notice">
            <AlertTriangle size={19} />
            <p>
              <T
                text={
                  "经济变强不保证不再卡顿：少造农民后，资源可能转为更多军队。应保持兵力、镜头一致，对比收入、FPS 与指令延迟。"
                }
              />
            </p>
          </div>
        </TabsContent>
        <TabsContent value="roadmap">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <T text="NEXT OPERATIONS" />
              </p>
              <h2>
                <T text={"先保证稳定，再做下一轮加强。"} />
              </h2>
            </div>
            <span className="meta muted">
              <T text={"以下均非已发布改动"} />
            </span>
          </div>
          <div className="roadmap">
            {proposals.map(([p, n, s, d]) => (
              <article key={n}>
                <span className={`priority ${p.toLowerCase()}`}>
                  <T text={p} />
                </span>
                <div>
                  <h3>
                    <T text={n} />
                    <span>
                      <T text={s} />
                    </span>
                  </h3>
                  <p>
                    <T text={d} />
                  </p>
                </div>
              </article>
            ))}
          </div>
          <div className="info-grid">
            <section className="panel">
              <h3>
                <T text={"已经写入的优化"} />
              </h3>
              {[
                "额外坠机伤害与追踪已删除",
                "据点每 5 秒局部检查，中英易手通知",
                "工二 40 工人；大学 3000/2000/500、20 工人、3 座",
                "60 工业工人与双倍交资源：离线通过",
                "矿场升级、奇迹收益、飞机加油减速：离线通过",
              ].map((t) => (
                <p className="check-line" key={t}>
                  <Check size={18} />
                  <T text={t} />
                </p>
              ))}
            </section>
            <section className="panel">
              <h3>
                <T text={"发布前最短验收"} />
              </h3>
              <ol className="test-list">
                <li>
                  <T text={"核对实际挂载版本，排除暂停与弃用项。"} />
                </li>
                <li>
                  <T text={"测试英雄、强化装备图标、并行队列与限额。"} />
                </li>
                <li>
                  <T text={"计时矿场升级、收入、奇迹效果和飞机加油。"} />
                </li>
                <li>
                  <T text={"验证据点争夺、通知、奖励及大规模性能。"} />
                </li>
                <li>
                  <T text={"最后同步玩家说明；伞兵另开空图独测。"} />
                </li>
              </ol>
            </section>
          </div>
        </TabsContent>
      </Tabs>
      <div className="reference-link">
        <div>
          <h3>
            <T text={"需要完整的技术明细？"} />
          </h3>
          <p>
            <T text={"护甲索引、海军、运输容量、测试记录与全部建议，保留在完整归档中。"} />
          </p>
        </div>
        <Link href="/reference" className="button">
          <T text={"查阅完整档案"} /> <ArrowUpRight size={18} />
        </Link>
        <a
          href="/stalingrad-reference.md"
          className="icon-link"
          download
          aria-label={t("下载完整 Markdown 档案")}
        >
          <Download size={20} />
        </a>
      </div>
    </div>
  );
}
