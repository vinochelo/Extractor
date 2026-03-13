'use client';

import { Badge } from "@/components/ui/badge";
import type { RetentionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: RetentionStatus;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const getStatusStyles = (status: RetentionStatus) => {
        switch(status) {
          case 'Solicitado':
            return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100';
          case 'Pendiente Anular':
            return 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50';
          case 'Anulado':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50';
          case 'No Recibido':
            return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-50';
          default:
            return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <Badge variant="outline" className={cn("font-medium px-2 py-0.5 transition-colors", getStatusStyles(status), className)}>
            {status}
        </Badge>
    );
}
