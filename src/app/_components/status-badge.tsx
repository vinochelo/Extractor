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
            return 'outline';
          case 'Pendiente Anular':
            return 'outline';
          case 'Anulado':
            return 'secondary';
          case 'No Recibido':
            return 'outline';
          default:
            return 'outline';
        }
      };

    return (
        <Badge variant={getBadgeVariant(status)} className={cn("font-medium", className)}>
            {status}
        </Badge>
    );
}
