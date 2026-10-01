"use client";

import { cn } from "@/lib/utils";
import type { Sociedad } from "@/lib/types";

interface SociedadBadgeProps {
  sociedad?: Sociedad | null;
  className?: string;
}

/**
 * Badge compacto que identifica la sociedad emisora de la retención.
 * - Etafashion (Comercial Etatex): fondo negro, texto blanco
 * - RM (Tiendas G.S.A.): fondo rojo, texto blanco
 * - Desconocida / sin dato: fondo gris neutro
 */
export function SociedadBadge({ sociedad, className }: SociedadBadgeProps) {
  if (!sociedad || sociedad === "Desconocida") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground border border-border/60",
          className
        )}
      >
        —
      </span>
    );
  }

  if (sociedad === "Etafashion") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-neutral-900 text-white border border-neutral-800 shadow-sm",
          className
        )}
      >
        ETAFASHION
      </span>
    );
  }

  // RM
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-red-600 text-white border border-red-700 shadow-sm",
        className
      )}
    >
      RM
    </span>
  );
}

/**
 * Devuelve las clases CSS para aplicar el color de borde izquierdo a una fila
 * según la sociedad, dando un toque visual sutil sin ser llamativo.
 */
export function getSociedadRowClass(sociedad?: Sociedad | null): string {
  if (sociedad === "Etafashion") return "border-l-2 border-l-neutral-800";
  if (sociedad === "RM") return "border-l-2 border-l-red-500";
  return "border-l-2 border-l-transparent";
}
