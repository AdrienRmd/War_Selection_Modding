import { bindings } from "@/lib/atlas-server";
import { stalingradDefault, type EditableMap } from "@/lib/map-content";
export type FeaturedRow={id:string;body:string;revision:number;updated_at:string;file_key:string|null;file_name:string;file_size:number;sha256:string;cover_key:string|null;cover_type:string|null};
export async function featuredRow(){return bindings().DB.prepare("SELECT * FROM featured_maps WHERE id = ?").bind("stalingrad").first<FeaturedRow>();}
export async function getFeaturedMap():Promise<EditableMap>{const r=await featuredRow();if(!r)return stalingradDefault;return {...stalingradDefault,...JSON.parse(r.body),id:r.id,revision:r.revision,updated_at:r.updated_at,file_name:r.file_name,file_size:r.file_size,sha256:r.sha256,has_file:!!r.file_key,has_cover:!!r.cover_key};}
