"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useBilingual, useI18n } from "@/components/i18n";
import { UPDATED_AT_URL, formatPublishedDate, type DatasetMeta } from "@/lib/units";

// Badge « données mises à jour le … » — factorisation V3-P2 #5 des quatre
// implémentations dupliquées (/units, /researches, /modding et l'en-tête de
// l'atelier simple). Même rendu qu'avant : classes units-badge /
// units-badge-loading et data-badge par page inchangés (les tests s'y fient).
// La version affichée vient toujours du manifeste du dataset (publishedAt +
// compte), jamais codée en dur.

/** Manifeste de version tel que servi par /wus-data/updated-at.json. */
export interface DatasetBadgeMeta {
  datasetId?: string;
  gameVersion?: string;
  publishedAt?: string;
  counts?: { units?: number; researches?: number; treeFiles?: number };
}

/** Charge une fois le manifeste de version (repli « failed » sur erreur). */
export function useDatasetMeta(url = UPDATED_AT_URL): {
  meta: DatasetBadgeMeta | null;
  failed: boolean;
} {
  const [meta, setMeta] = useState<DatasetBadgeMeta | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (!alive) return;
        if (typeof data !== "object" || data === null) throw new Error("bad meta");
        setMeta(data as DatasetBadgeMeta);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [url]);
  return { meta, failed };
}

/** Coquille visuelle partagée : <span class="units-badge" data-badge=…>. */
export function DatasetBadge({
  testId,
  loading = false,
  children,
}: {
  testId: string;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={loading ? "units-badge units-badge-loading" : "units-badge"}
      data-badge={testId}
    >
      {children}
    </span>
  );
}

/**
 * Badge complet « données mises à jour <date>，共 <N> <noun> » des pages de
 * dataset : trois états (échec / version / lecture en cours). Le compte est
 * calculé par la page (manifeste si présent, sinon repli embarqué) et `noun`
 * termine la clé template i18n (« 个单位 », « 项研究 », « 个参数节点 »).
 */
export function UpdatedDatasetBadge({
  testId,
  meta,
  failed,
  count,
  noun,
}: {
  testId: string;
  /** Manifeste déjà chargé (structurel : publishedAt suffit au badge). */
  meta: Pick<DatasetMeta, "publishedAt"> | null;
  failed: boolean;
  count: number;
  noun: string;
}) {
  const { locale, t } = useI18n();
  const l = useBilingual();
  if (failed)
    return (
      <DatasetBadge testId={testId}>
        {l("数据版本暂时不可用", "Dataset version unavailable")}
      </DatasetBadge>
    );
  if (meta)
    return (
      <DatasetBadge testId={testId}>
        {t(`数据更新于 ${formatPublishedDate(meta.publishedAt ?? "", locale)}，共 ${count} ${noun}`)}
      </DatasetBadge>
    );
  return (
    <DatasetBadge testId={testId} loading>
      {l("正在读取数据版本…", "Reading dataset version…")}
    </DatasetBadge>
  );
}
