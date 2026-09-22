"use client";
import type { ComponentProps } from "react";
import {useI18n} from "@/components/i18n";
// Native navigation keeps all routes functional when the hosting runtime's
// client-side RSC prefetch bridge is unavailable. Forms and tabs stay interactive.
export default function SiteLink(props:ComponentProps<"a">){const {t}=useI18n();return <a {...props} aria-label={props["aria-label"]?t(props["aria-label"]):undefined} title={props.title?t(props.title):undefined}/>;}
