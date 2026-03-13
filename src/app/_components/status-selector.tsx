'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RetentionRecord, RetentionStatus } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { Archive, FileWarning, XCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StatusSelectorProps {
  retention: RetentionRecord;
}

export function StatusSelector({ retention }: StatusSelectorProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleStatusChange = (newStatus: RetentionStatus) => {
    if (!firestore || !user?.uid) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo conectar con la base de datos.',
      });
      return;
    }

    const retentionRef = doc(
      firestore,
      `users/${user.uid}/retenciones`,
      retention.id
    );

    updateDocumentNonBlocking(retentionRef, { estado: newStatus });

    toast({
      title: 'Estado Actualizado',
      description: `La retención ahora está en estado: ${newStatus}.`,
    });
  };

  const isSriAnulado = 
    retention.sriEstado?.toUpperCase() === 'ANULADO' || 
    retention.sriEstado?.toUpperCase() === 'CANCELADO';

  // Si el SRI ya está anulado y aún no está archivado en la app, 
  // mostramos el botón directo de "Archivar"
  if (isSriAnulado && retention.estado !== 'Anulado') {
    return (
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => handleStatusChange('Anulado')}
        className="h-7 px-3 bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 font-bold animate-pulse"
      >
        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
        Archivar
      </Button>
    );
  }

  const availableActions: ({
    label: string;
    action: () => void;
    icon: React.ReactNode;
    isDestructive?: boolean;
    separator?: boolean;
    isPrimary?: boolean;
  })[] = [];

  if (retention.estado === 'Solicitado') {
    availableActions.push({
      label: 'Marcar Pendiente Anular',
      action: () => handleStatusChange('Pendiente Anular'),
      icon: <FileWarning className="mr-2 h-4 w-4" />,
    });
  }

  if (retention.estado === 'Pendiente Anular') {
    availableActions.push({
        label: 'Marcar como Anulado',
        action: () => handleStatusChange('Anulado'),
        icon: <Archive className="mr-2 h-4 w-4" />,
    });
    availableActions.push({
        label: 'Marcar No Recibido',
        action: () => handleStatusChange('No Recibido'),
        icon: <XCircle className="mr-2 h-4 w-4" />,
    });
  }

  // Si no hay acciones disponibles (ej. ya está Anulado), solo mostrar el badge estático
  if (availableActions.length === 0) {
    return <StatusBadge status={retention.estado} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="outline-none">
          <StatusBadge status={retention.estado} className="cursor-pointer hover:opacity-80 transition-opacity" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {availableActions.filter(a => a.label).map((action, index) => (
            <React.Fragment key={index}>
                {action.separator && <DropdownMenuSeparator />}
                <DropdownMenuItem 
                    onSelect={action.action} 
                    className={action.isPrimary ? "font-bold text-emerald-700 bg-emerald-50" : ""}
                >
                    {action.icon}
                    <span>{action.label}</span>
                </DropdownMenuItem>
            </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
