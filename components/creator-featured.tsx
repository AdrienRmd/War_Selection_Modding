import { T } from "@/components/i18n";
import Link from "@/components/site-link";
import { Pencil, ArrowUpRight } from "lucide-react";
export function CreatorFeatured() {
  return (
    <>
      <section className="creator-featured">
        <div>
          <p className="eyebrow">
            <T text={"FEATURED MAP · 作者管理"} />
          </p>
          <h2>
            <T text={"斯大林格勒"} />
          </h2>
          <p>
            <T text={"独立维护的精选地图，编辑入口不再依赖投稿记录。"} />
          </p>
        </div>
        <div className="workbench-actions">
          <Link className="button" href="/maps/stalingrad">
            <T text={"查看地图"} />
            <ArrowUpRight size={16} />
          </Link>
          <Link className="button primary" href="/maps/stalingrad/edit">
            <Pencil size={16} /> <T text={"编辑斯大林格勒"} />
          </Link>
        </div>
      </section>
      <section className="collection-management">
        <div>
          <h2>
            <T text="收藏地图档案" />
          </h2>
          <p>
            <T text="补充地图名称与原作者，记录测试状态，隐藏或恢复收藏。" />
          </p>
        </div>
        <Link className="button" href="/maps/collection/manage">
          <Pencil size={16} />
          <T text="管理收藏地图" />
        </Link>
      </section>
    </>
  );
}
