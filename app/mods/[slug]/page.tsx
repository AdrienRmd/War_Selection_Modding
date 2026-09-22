import { notFound } from "next/navigation";
import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import { ModDetail } from "@/components/mod-detail";
import { rawMod, publicMod } from "@/lib/mod-server";
import { sourceReferences } from "@/lib/mod-seeds";
import { identity } from "@/lib/atlas-server";
export const dynamic = "force-dynamic";
export default async function ModPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await rawMod(slug),
    { user, admin } = await identity();
  if (!m || (m.status !== "approved" && m.owner_id !== user?.userId && !admin)) notFound();
  return (
    <>
      <AtlasHeader />
      <main className="shell">
        <ModDetail
          entry={publicMod(m, !!user && (admin || m.owner_id === user.userId))}
          reference={sourceReferences[slug]}
        />
      </main>
      <AtlasFooter />
    </>
  );
}
