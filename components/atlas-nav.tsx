"use client";
import {T,useI18n} from "@/components/i18n";

import {usePathname} from "next/navigation";
import {SlidersHorizontal,ShieldCheck} from "lucide-react";
import Link from "@/components/site-link";
export function AtlasNav({admin}:{admin:boolean}){const {t}=useI18n();const path=usePathname()||"/";return <nav aria-label={t("主导航")}>{[{href:"/maps",name:"地图档案",active:path==="/"||path.startsWith("/maps")},{href:"/mods",name:"Mod 资料库",active:path.startsWith("/mods")},{href:"/workbench",name:"Mod 工作台",active:path.startsWith("/workbench"),icon:<SlidersHorizontal size={15}/>},{href:"/submissions",name:"我的创作",active:path.startsWith("/submissions")},...(admin?[{href:"/admin",name:"管理",active:path.startsWith("/admin"),icon:<ShieldCheck size={15}/>}]:[])].map(i=><Link key={i.href} href={i.href} aria-current={i.active?"page":undefined}><T text={i.icon}/><T text={i.name}/></Link>)}</nav>;}
