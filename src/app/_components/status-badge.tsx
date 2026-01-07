'use client';

import { Badge } from "@/components/ui/badge";
import type { RetentionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: RetentionStatus;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const getBadgeVariant = (status: RetentionStatus) => {
        switch(status) {
          case 'Solicitado':
            return 'success';
          case 'Pendiente Anular':
            return 'warning';
          case 'Anulado':
            return 'neutral';
          case 'No Recibido':
            return 'destructive';
          default:
            return 'outline';
        }
      };

    return <Badge variant={getBadgeVariant(status)} className={cn(className)}>{status}</Badge>;
}
