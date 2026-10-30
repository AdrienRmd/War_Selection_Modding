import { AtlasHeader, AtlasFooter } from "@/components/atlas-shell";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-metadata";
import { SimpleWorkbench } from "@/components/simple-workbench";
import { unitsIndex } from "@/lib/units";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("workbenchSimple");
}
export default function WorkbenchSimple() {
  // Étape 1 rendue côté serveur (recherche + cartes depuis l'index embarqué) :
  // le HTML initial contient déjà la liste des unités avant tout chargement JS.
  return (
    <>
      <AtlasHeader />
      <SimpleWorkbench index={unitsIndex} />
      <AtlasFooter />
    </>
  );
}
