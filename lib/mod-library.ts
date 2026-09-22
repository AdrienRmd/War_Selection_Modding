import {mods} from "@/lib/stalingrad";
const slugs=["stalingrad-rules","ground-balance","air-logistics","lean-economy","late-game","legendary-heroes","housing","strongpoints","transport","opening-guide","old-territory","general-winter","order-227","old-paratroopers","paratrooper-test","paratrooper-diagnostics","external-config"];
export const modLibrary=mods.map((m,i)=>({...m,slug:slugs[i],map:"斯大林格勒",asOf:"2026-09-09"}));
