import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { ModWorkbench } from "@/components/mod-workbench";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("workbench");
}
export default function Workbench() {
  return (
    <>
      <AtlasHeader />
      <ModWorkbench />
      <AtlasFooter />
    </>
  );
}
