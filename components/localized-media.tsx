"use client";
import type { ComponentProps } from "react";
import { useI18n } from "@/components/i18n";

// Client wrappers keep accessible text in sync with the language switcher,
// including images and navigation created by server-rendered pages.
export function LocalizedImage(props: ComponentProps<"img">) {
  const { t } = useI18n();
  return (
    <img
      {...props}
      alt={props.alt ? t(props.alt) : props.alt}
      title={props.title ? t(props.title) : undefined}
    />
  );
}
export function LocalizedNav(props: ComponentProps<"nav">) {
  const { t } = useI18n();
  return <nav {...props} aria-label={props["aria-label"] ? t(props["aria-label"]) : undefined} />;
}
