"use client";

import { Loader2Icon } from "lucide-react";

import { useI18n } from "@/components/i18n";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const { t } = useI18n();
  return (
    <Loader2Icon
      role="status"
      aria-label={t("Loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
