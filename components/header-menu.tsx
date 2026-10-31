"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/i18n";

/**
 * Menu déroulant du header (groupes « Archives » / « Mods » + « Compte »).
 *
 * Accessibilité :
 *  - déclencheur <button> avec aria-haspopup="menu" et aria-expanded mis à jour ;
 *  - panneau role="menu", entrées role="menuitem" fournies par l'appelant ;
 *  - Échap referme et rend le focus au déclencheur ;
 *  - flèches ↓/↑ au clavier depuis le déclencheur ou dans le panneau
 *    parcourent les entrées (Home/End = première/dernière, en boucle) ;
 *  - clic ou focus extérieur referme le menu ;
 *  - changement de route (navigation depuis une entrée) referme le menu.
 */
export function HeaderMenu({
  ariaLabel,
  trigger,
  active = false,
  align = "start",
  panelClassName = "",
  children,
}: {
  /** Libellé accessible (clé i18n zh) du menu, utilisé par le bouton et le panneau. */
  ariaLabel: string;
  /** Contenu visible du déclencheur (libellé ou avatar + nom). */
  trigger: ReactNode;
  /** True si une des entrées correspond à la route courante (surlignage). */
  active?: boolean;
  /** Ancrage du panneau : start (gauche) ou end (droite, menu compte). */
  align?: "start" | "end";
  /** Classe additionnelle du panneau. */
  panelClassName?: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Ouverture au clavier (↓/↑) : focaliser la première/dernière entrée dès que
  // le panneau est monté — via effet sur `open`, pas requestAnimationFrame
  // (une course avec le commit React laissait le focus sur le déclencheur).
  const focusOnOpen = useRef<"first" | "last" | null>(null);

  // Navigation depuis une entrée → refermer (ajustement pendant le rendu,
  // pattern recommandé plutôt qu'un effet qui rappelle setState).
  if (lastPath !== path) {
    setLastPath(path);
    if (open) setOpen(false);
  }

  // Focus sorti du menu (Tab au-delà de la dernière entrée) → refermer.
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!rootRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
  };

  const menuItems = (): HTMLElement[] =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const focusItem = (index: number) => {
    const items = menuItems();
    if (items.length === 0) return;
    items[(index + items.length) % items.length].focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Ouverture clavier → focus de la première/dernière entrée une fois montée.
  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const position = focusOnOpen.current;
    focusOnOpen.current = null;
    focusItem(position === "first" ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const triggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOnOpen.current = event.key === "ArrowDown" ? "first" : "last";
      setOpen(true);
    }
  };

  const panelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    const current = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(-1);
    }
  };

  return (
    <div className={`nav-menu${active ? " nav-menu-active" : ""}`} ref={rootRef} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className="nav-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(ariaLabel)}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={triggerKeyDown}
      >
        {trigger}
        <ChevronDown size={14} className="nav-chevron" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={t(ariaLabel)}
          className={`nav-menu-panel${align === "end" ? " nav-menu-panel-end" : ""}${panelClassName ? ` ${panelClassName}` : ""}`}
          onKeyDown={panelKeyDown}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
