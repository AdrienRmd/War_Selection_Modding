"use client";
import { T, useI18n } from "@/components/i18n";

import { useRef, useState } from "react";
import Link from "@/components/site-link";
import { UploadCloud, CheckCircle2, ArrowUpRight, ShieldCheck, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
export function SubmissionForm() {
  const { t } = useI18n();
  const [category, setCategory] = useState("历史战役"),
    [rights, setRights] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [fileName, setFileName] = useState(""),
    [coverName, setCoverName] = useState("");
  const id = useRef<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    data.set("category", category);
    data.set("rights", String(rights));
    const file = data.get("file");
    const cover = data.get("cover");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
      setError("请选择 10 MB 以内的地图 ZIP 包。");
      return;
    }
    if (cover instanceof File && cover.size > 2 * 1024 * 1024) {
      setError("封面不能超过 2 MB。");
      return;
    }
    if (!rights) {
      setError("请确认投稿授权与公开范围。");
      return;
    }
    setBusy(true);
    setError("");
    id.current ||= crypto.randomUUID();
    try {
      const r = await fetch("/api/atlas/submissions", {
        method: "POST",
        headers: { "X-Submission-Id": id.current },
        body: data,
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，内容仍保留，请重试。");
    } finally {
      setBusy(false);
    }
  }
  if (done)
    return (
      <div className="success-surface">
        <CheckCircle2 size={52} />
        <p className="eyebrow">
          <T text="SUBMISSION RECEIVED" />
        </p>
        <h2>
          <T text={"已收到，等待管理员检阅。"} />
        </h2>
        <p>
          <T text={"地图和封面尚未公开。你可以在“我的投稿”查看审核状态与修改意见。"} />
        </p>
        <Link className="button primary" href="/submissions">
          <T text={"查看我的投稿"} /> <ArrowUpRight size={18} />
        </Link>
      </div>
    );
  return (
    <div className="form-layout">
      <form className="atlas-form panel" onSubmit={submit}>
        <div className="form-section-heading">
          <span>01</span>
          <div>
            <h2>
              <T text={"建立地图档案"} />
            </h2>
            <p>
              <T text={"填写玩家需要知道的实际信息。"} />
            </p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <T text={"地图名称"} />{" "}
            <Input
              name="title"
              required
              minLength={2}
              maxLength={60}
              placeholder={t("例如：伏尔加河防线")}
            />
          </label>
          <label>
            <T text={"作者 / 团队名"} />{" "}
            <Input
              name="author"
              required
              minLength={2}
              maxLength={40}
              placeholder={t("公开显示的创作者名称")}
            />
          </label>
          <label>
            <T text={"游戏版本"} />{" "}
            <Input
              name="game_version"
              required
              maxLength={60}
              placeholder={t("填写实际测试客户端版本")}
            />
          </label>
          <label>
            <T text={"最大玩家数"} />{" "}
            <Input name="players" type="number" min={1} max={60} required defaultValue={30} />
          </label>
          <label>
            <T text={"地图类型"} />{" "}
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label={t("地图类型")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["历史战役", "团队对抗", "生存合作", "自定义玩法"].map((c) => (
                  <SelectItem key={c} value={c}>
                    <T text={c} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label>
            <T text={"游戏内地图分享码（选填）"} />
            <Input name="map_code" maxLength={150} placeholder={t("请填写真实可用的分享码")} />
          </label>
        </div>
        <label>
          <T text={"一句话介绍"} />{" "}
          <Input
            name="summary"
            required
            minLength={10}
            maxLength={180}
            placeholder={t("10–180 字，介绍这张地图最值得玩的地方")}
          />
        </label>
        <label>
          <T text={"地图玩法与使用说明"} />{" "}
          <Textarea
            name="description"
            required
            minLength={30}
            maxLength={6000}
            rows={7}
            placeholder={t(
              "至少 30 字。说明胜利条件、阵营设置、安装/导入方法、已知问题及实际测试情况。",
            )}
          />
        </label>
        <label>
          <T text={"所需 Mod 与加载顺序"} />{" "}
          <Textarea
            name="mods"
            maxLength={4000}
            rows={4}
            placeholder={t(
              "每行一个 Mod：名称、版本、玩法/视觉、功能及是否必须。没有 Mod 请写“无”。",
            )}
          />
        </label>
        <div className="form-section-heading">
          <span>02</span>
          <div>
            <h2>
              <T text={"上传地图包与封面"} />
            </h2>
            <p>
              <T text={"文件将在审核前保持私有。"} />
            </p>
          </div>
        </div>
        <div className="upload-grid">
          <label className="upload-box">
            <FileArchive size={30} />
            <strong>
              <T text={fileName || "选择地图 ZIP 包"} />
            </strong>
            <span>
              <T text={"必填 · 最大 10 MB · 包含使用说明"} />
            </span>
            <Input
              type="file"
              name="file"
              accept=".zip,application/zip"
              required
              onChange={(e) => setFileName(e.target.files?.[0]?.name || "")}
            />
          </label>
          <label className="upload-box">
            <UploadCloud size={30} />
            <strong>
              <T text={coverName || "添加地图封面"} />
            </strong>
            <span>
              <T text={"选填 · PNG / JPEG · 最大 2 MB"} />
            </span>
            <Input
              type="file"
              name="cover"
              accept="image/png,image/jpeg"
              onChange={(e) => setCoverName(e.target.files?.[0]?.name || "")}
            />
          </label>
        </div>
        <label className="check-line rights">
          <Checkbox
            checked={rights}
            onCheckedChange={(v) => setRights(v === true)}
            aria-label={t("确认投稿授权")}
          />
          <span>
            <T
              text={
                "我拥有或已获授权分享上述内容，同意审核通过后公开地图资料、作者名、封面及地图 ZIP 包。我已阅读"
              }
            />
            <Link className="text-link inline-link" href="/guidelines" target="_blank">
              <T text={"投稿规范"} />
            </Link>
            <T text={"。"} />
          </span>
        </label>
        {error && (
          <div className="notice error" role="alert">
            <T text={error} />
          </div>
        )}
        <div className="form-submit">
          <p className="meta muted">
            <T text={"每人最多 3 份待审核，24 小时内最多投稿 5 次。"} />
          </p>
          <Button className="button primary" type="submit" disabled={busy || !rights}>
            <T text={busy ? "正在提交，请稍候…" : "提交审核"} />
            <ArrowUpRight size={18} />
          </Button>
        </div>
      </form>
      <aside className="detail-aside">
        <section className="panel review-process">
          <ShieldCheck size={32} />
          <p className="eyebrow">
            <T text="CURATED, NOT AUTOMATIC" />
          </p>
          <h2>
            <T text={"先检查，再上架。"} />
          </h2>
          <ol>
            <li>
              <b>
                <T text={"01 · 玩家投稿"} />
              </b>
              <p>
                <T text={"地图文件、封面与说明进入待审核区。"} />
              </p>
            </li>
            <li>
              <b>
                <T text={"02 · 管理员检阅"} />
              </b>
              <p>
                <T text={"核对分享权限、检查文件、实机测试和说明一致性。"} />
              </p>
            </li>
            <li>
              <b>
                <T text={"03 · 发布或退回"} />
              </b>
              <p>
                <T text={"通过后展示给玩家；需要修改时附具体意见。"} />
              </p>
            </li>
          </ol>
        </section>
        <section className="panel">
          <h3>
            <T text={"什么不会被公开？"} />
          </h3>
          <p>
            <T
              text={
                "登录邮箱、账号标识、待审核及退回稿件不会出现在公共地图列表。管理员可检查你提交的全部内容。"
              }
            />
          </p>
          <p className="caption">
            <T
              text={
                "文件检查并非自动病毒扫描。请勿上传可执行安装器、账号信息、个人隐私或无授权素材。"
              }
            />
          </p>
        </section>
      </aside>
    </div>
  );
}
