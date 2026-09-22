import { T } from "@/components/i18n";
import Link from "@/components/site-link";
export default function NotFound() {
  return (
    <main className="shell">
      <div className="empty-surface">
        <p className="eyebrow">404 / OUTSIDE THE ARCHIVE</p>
        <h1>
          <T text={"这份战场档案还没有公开。"} />
        </h1>
        <p>
          <T text={"地图可能尚未审核、已撤回，或链接有误。"} />
        </p>
        <Link href="/" className="button primary">
          <T text={"返回地图档案"} />
        </Link>
      </div>
    </main>
  );
}
