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

  const isSriAnulado = retention.sriEstado?.toUpperCase() === 'ANULADO' || retention.sriEstado?.toUpperCase() === 'CANCELADO';

  const availableActions: ({
    label: string;
    action: () => void;
    icon: React.ReactNode;
    isDestructive?: boolean;
    separator?: boolean;
    isPrimary?: boolean;
  })[] = [];

  // Recomendación si SRI ya está anulado
  if (isSriAnulado && retention.estado !== 'Anulado') {
    availableActions.push({
      label: 'Archivar (Ya Anulado en SRI)',
      action: () => handleStatusChange('Anulado'),
      icon: <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />,
      isPrimary: true,
    });
    availableActions.push({
      separator: true,
      label: '', action: () => {}, icon: null
    });
  }

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