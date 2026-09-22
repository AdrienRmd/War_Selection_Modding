import { LocalizedNav } from "@/components/localized-media";

import { T } from "@/components/i18n";
import { AtlasHeader, AtlasFooter, PageTitle } from "@/components/atlas-shell";
import { reference } from "@/lib/reference";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
export const dynamic = "force-dynamic";
export const metadata = { title: "斯大林格勒完整技术档案 | WS ATLAS" };
function Document() {
  const lines = reference.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.startsWith("# ")) continue;
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|\-]+\|$/.test(lines[i]))
          rows.push(
            lines[i]
              .split("|")
              .slice(1, -1)
              .map((s) => s.trim()),
          );
        i++;
      }
      i--;
      nodes.push(
        <Table key={i}>
          <TableHeader>
            <TableRow>
              {rows[0].map((v, j) => (
                <TableHead key={j}>{v}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(1).map((row, j) => (
              <TableRow key={j}>
                {row.map((v, k) => (
                  <TableCell key={k}>{v}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>,
      );
    } else if (line.startsWith("## ")) {
      nodes.push(
        <h2 id={`section-${line.match(/^## (\d+)/)?.[1] || i}`} key={i}>
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      nodes.push(<h3 key={i}>{line.slice(4)}</h3>);
    } else if (line.startsWith("- ")) {
      const list: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) list.push(lines[i++].slice(2));
      i--;
      nodes.push(
        <ul key={i}>
          {list.map((s, j) => (
            <li key={j}>{s}</li>
          ))}
        </ul>,
      );
    } else nodes.push(<p key={i}>{line.replace(/`/g, "")}</p>);
  }
  return nodes;
}
export default function Reference() {
  return (
    <>
      <AtlasHeader />
      <main className="shell reference-page">
        <PageTitle
          eyebrow="SOURCE ARCHIVE / AS OF 2026.09.09"
          title="完整技术档案"
          text="当前代码、验收边界与历史建议分开保留。数据来自地图作者本地整理，非实时游戏数据库。"
        />
        <LocalizedNav className="reference-nav" aria-label="技术档案章节">
          {[
            [2, "Mod 清单"],
            [3, "核心规则"],
            [4, "地面与护甲"],
            [5, "飞机"],
            [6, "英雄"],
            [7, "经济与运输"],
            [8, "加载冲突"],
            [9, "改进建议"],
            [10, "测试记录"],
          ].map(([n, t]) => (
            <a key={n} href={`#section-${n}`}>
              <T text={t} />
            </a>
          ))}
          <a href="/stalingrad-reference.md" download>
            <T text={"下载 Markdown"} />
          </a>
        </LocalizedNav>
        <section className="notice subtle">
          <div>
            <h2>
              <T text={"原始中文技术档案"} />
            </h2>
            <p>
              <T
                text={
                  "以下为保留原文的中文历史资料。英文概览、规则、Mod 状态及主要数值请查阅斯大林格勒地图页与 Mod 资料库；历史记录不代表当前版本已实机验收。"
                }
              />
            </p>
          </div>
        </section>
        <article className="prose" lang="zh-CN">
          <Document />
        </article>
      </main>
      <AtlasFooter />
    </>
  );
}
