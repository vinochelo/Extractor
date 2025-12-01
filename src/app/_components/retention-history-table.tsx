"use client";

import { useMemo, useState } from 'react';
import { useUser, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, FileWarning, Archive, RotateCcw, Trash2, Mail, Send } from 'lucide-react';
import { format } from 'date-fns';
import type { RetentionRecord, RetentionStatus } from '@/lib/types';
import { StatusSelector } from './status-selector';
import { StatusBadge } from './status-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getEmailByRuc } from '@/lib/provider-emails';

// Helper to format keys for display
const formatDisplayKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      numeroRetencion: "Nro. Retención",
      numeroAutorizacion: "Autorización",
      razonSocialProveedor: "Razón Social Proveedor",
      rucProveedor: "RUC Proveedor",
      numeroFactura: "Nro. Factura",
      fechaEmision: "Fecha Emisión",
    };
    return keyMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

const desiredOrder: (keyof RetentionRecord)[] = [
    'numeroRetencion',
    'numeroAutorizacion',
    'razonSocialProveedor',
    'rucProveedor',
    'numeroFactura',
    'fechaEmision'
];

export function RetentionHistoryTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [retentionToDelete, setRetentionToDelete] = useState<RetentionRecord | null>(null);
  const [selectedRetentions, setSelectedRetentions] = useState<Record<string, RetentionRecord>>({});

  const retencionesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, `users/${user.uid}/retenciones`),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, user?.uid]);

  const {
    data: retenciones,
    isLoading: loading,
    error,
  } = useCollection<RetentionRecord>(retencionesQuery);

  const { activeRetenciones, anulatedRetenciones } = useMemo(() => {
    const active = retenciones?.filter(r => r.estado !== 'Anulado') || [];
    const anulated = retenciones?.filter(r => r.estado === 'Anulado') || [];
    return { activeRetenciones: active, anulatedRetenciones: anulated };
  }, [retenciones]);

  const selectedCount = Object.keys(selectedRetentions).length;

  const handleSelectRetention = (retention: RetentionRecord, isSelected: boolean) => {
    setSelectedRetentions(prev => {
        const newSelected = { ...prev };
        if (isSelected) {
            newSelected[retention.id] = retention;
        } else {
            delete newSelected[retention.id];
        }
        return newSelected;
    });
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
        const allActive = activeRetenciones.reduce((acc, r) => {
            acc[r.id] = r;
            return acc;
        }, {} as Record<string, RetentionRecord>);
        setSelectedRetentions(allActive);
    } else {
        setSelectedRetentions({});
    }
  };


  const generateFormattedText = (data: RetentionRecord) => {
    return desiredOrder
      .map(key => {
          const value = data[key];
          if (value !== undefined && value !== null) {
              return `${formatDisplayKey(key)}: ${value}`;
          }
          return null;
      })
      .filter(Boolean)
      .join('\n');
  }

  const handleBulkShareForVoiding = () => {
    const selectedItems = Object.values(selectedRetentions);
    const emailBody = selectedItems.map(item => 
        `Detalles de la retención a anular:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`
    ).join('\n\n');

    const subject = "Anulación de Múltiples Retenciones";
    const body = encodeURIComponent(`Buenos días,\n\nFavor su ayuda anulando las retenciones adjuntas.\n\n${emailBody}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleBulkRequestSriAcceptance = () => {
    const selectedItems = Object.values(selectedRetentions);
    const groupedByProvider = selectedItems.reduce((acc, item) => {
        const key = item.rucProveedor || 'unknown';
        if (!acc[key]) {
            acc[key] = {
                providerName: item.razonSocialProveedor,
                email: getEmailByRuc(item.rucProveedor),
                items: []
            };
        }
        acc[key].items.push(item);
        return acc;
    }, {} as Record<string, { providerName: string; email: string; items: RetentionRecord[] }>);

    Object.values(groupedByProvider).forEach(group => {
        const subject = `Anulación de retenciones`;
        const itemsBody = group.items.map(item => 
            `Detalles de la retención:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`
        ).join('\n\n');
        
        const emailBody = `Estimados ${group.providerName},\n\nPor medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a las siguientes retenciones:\n\n${itemsBody}\n\nAgradecemos su pronta gestión.`;
        
        const body = encodeURIComponent(emailBody);
        window.open(`mailto:${group.email}?subject=${subject}&body=${body}`);
    });
  };

  const handleShareForVoiding = (data: RetentionRecord) => {
    const formattedTextForEmail = generateFormattedText(data);
    const subject = "Anulación de Retención";
    const emailBody = `Buenos días,

Favor su ayuda anulando la retención adjunta.

Detalles de la retención a anular:
--------------------------------
${formattedTextForEmail}
--------------------------------
`;
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleRequestSriAcceptance = (data: RetentionRecord) => {
    const providerEmail = getEmailByRuc(data.rucProveedor);
    const formattedTextForEmail = generateFormattedText(data);
    const subject = `Anulación retención ${data.numeroRetencion}`;
    const emailBody = `Estimados ${data.razonSocialProveedor},

Por medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a la siguiente retención:

Detalles de la retención:
--------------------------------
${formattedTextForEmail}
--------------------------------

Agradecemos su pronta gestión.
`;
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${providerEmail}?subject=${subject}&body=${body}`;
  };

  const handleRevertStatus = (retention: RetentionRecord) => {
    if (!firestore || !user?.uid) return;

    let previousStatus: RetentionStatus | null = null;
    if (retention.estado === 'Pendiente Anular') {
      previousStatus = 'Solicitado';
    } else if (retention.estado === 'Anulado') {
      previousStatus = 'Pendiente Anular';
    }
    
    if (previousStatus) {
        const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retention.id);
        updateDocumentNonBlocking(retentionRef, { estado: previousStatus });
        toast({
            title: 'Estado Revertido',
            description: `La retención ha vuelto al estado: ${previousStatus}.`,
        });
    }
  };

  const handleDelete = () => {
    if (!firestore || !user?.uid || !retentionToDelete) return;
    
    const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retentionToDelete.id);
    deleteDocumentNonBlocking(retentionRef);
    
    toast({
      title: 'Retención Eliminada',
      description: `La retención ha sido eliminada permanentemente.`,
    });
    setRetentionToDelete(null);
  };
  
  const handleVerifySri = (numeroAutorizacion: string) => {
    navigator.clipboard.writeText(numeroAutorizacion).then(() => {
      toast({
        title: 'Copiado al portapapeles',
        description: 'El número de autorización ha sido copiado.',
      });
      window.open('https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf?pathMPT=Facturaci%F3n%20Electr%F3nica&actualMPT=Validez%20de%20comprobantes', '_blank', 'noopener,noreferrer');
    });
  };


  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) {
      // Firebase Timestamp
      return format(date.toDate(), 'dd/MM/yyyy HH:mm');
    }
    try {
      // For strings or numbers from client side generation
      return format(new Date(date), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Fecha inválida';
    }
  };

  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-4" /></TableCell>
        <TableCell>
            <div className="flex items-center gap-1">
                <Skeleton className="h-9 w-9" />
                <Skeleton className="h-9 w-9" />
            </div>
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-40" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-6 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-28" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-9 w-32" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-9 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-32" />
        </TableCell>
      </TableRow>
    ));

  const renderTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={11} className="h-24 text-center">
            No hay retenciones en esta categoría.
          </TableCell>
        </TableRow>
      );
    }
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id} data-state={selectedRetentions[item.id] ? 'selected' : ''}>
        <TableCell className="py-2">
            <Checkbox
                checked={!!selectedRetentions[item.id]}
                onCheckedChange={(value) => handleSelectRetention(item, !!value)}
                aria-label="Seleccionar retención"
            />
        </TableCell>
        <TableCell>
            <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleShareForVoiding(item)} disabled={selectedCount > 0}>
                            <Mail className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Email para Anular</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleRequestSriAcceptance(item)} disabled={selectedCount > 0}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Solicitar Aceptación SRI</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TableCell>
        <TableCell className="font-mono">{item.numeroRetencion}</TableCell>
        <TableCell className="font-medium">
          {item.razonSocialProveedor}
        </TableCell>
        <TableCell>{item.numeroFactura}</TableCell>
        <TableCell>
          <StatusSelector retention={item} />
        </TableCell>
        <TableCell>{formatDate(item.createdAt)}</TableCell>
        <TableCell>{item.fechaEmision}</TableCell>
        <TableCell>
            <Button size="sm" variant="outline" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Verificar en SRI
            </Button>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {item.estado !== 'Solicitado' && (
                <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => handleRevertStatus(item)}>
                          <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Revertir Estado</p>
                    </TooltipContent>
                </Tooltip>
            )}
            <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRetentionToDelete(item)}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Eliminar</p>
                </TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
        <TableCell>
            <span className="font-mono text-xs">{item.numeroAutorizacion}</span>
        </TableCell>
      </TableRow>
    ));
  };
  
  const renderAnulatedTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={10} className="h-24 text-center">
            No hay retenciones en esta categoría.
          </TableCell>
        </TableRow>
      );
    }
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id}>
         <TableCell>
            <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleShareForVoiding(item)} disabled={selectedCount > 0}>
                            <Mail className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Email para Anular</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleRequestSriAcceptance(item)} disabled={selectedCount > 0}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Solicitar Aceptación SRI</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TableCell>
        <TableCell className="font-mono">{item.numeroRetencion}</TableCell>
        <TableCell className="font-medium">
          {item.razonSocialProveedor}
        </TableCell>
        <TableCell>{item.numeroFactura}</TableCell>
        <TableCell><StatusBadge status={item.estado} /></TableCell>
        <TableCell>{formatDate(item.createdAt)}</TableCell>
        <TableCell>{item.fechaEmision}</TableCell>
        <TableCell>
            <Button size="sm" variant="outline" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Verificar en SRI
            </Button>
        </TableCell>
        <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" onClick={() => handleRevertStatus(item)}>
                          <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Revertir a Pendiente Anular</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRetentionToDelete(item)}>
                          <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Eliminar</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </TableCell>
        <TableCell>
            <span className="font-mono text-xs">{item.numeroAutorizacion}</span>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <TooltipProvider>
    <Card className="w-full max-w-7xl mx-auto">
      <CardHeader>
        <CardTitle>Historial de Retenciones</CardTitle>
        <CardDescription>
          Aquí puedes ver y gestionar todas las retenciones que has procesado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Error al Cargar Historial</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center gap-4 mb-4">
            <Button onClick={handleBulkShareForVoiding} disabled={selectedCount === 0}>
                <Mail className="mr-2" />
                Email para Anular ({selectedCount})
            </Button>
            <Button onClick={handleBulkRequestSriAcceptance} disabled={selectedCount === 0}>
                <Send className="mr-2" />
                Solicitar Aceptación SRI ({selectedCount})
            </Button>
        </div>


        <div className="border rounded-lg mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedCount > 0 && selectedCount === activeRetenciones.length}
                    onCheckedChange={(value) => handleSelectAll(!!value)}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
                <TableHead>Emails</TableHead>
                <TableHead>Nro. Retención</TableHead>
                <TableHead>Razón Social Proveedor</TableHead>
                <TableHead>Nro. Factura</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Verificar SRI</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
                <TableHead>Autorización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? renderSkeleton() : renderTableRows(activeRetenciones)}
            </TableBody>
          </Table>
        </div>

        {(anulatedRetenciones.length > 0 || loading) && (
          <Accordion type="single" collapsible className="w-full" disabled={loading}>
            <AccordionItem value="anuladas">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Mostrar Retenciones Anuladas ({loading ? '...' : anulatedRetenciones.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Emails</TableHead>
                        <TableHead>Nro. Retención</TableHead>
                        <TableHead>Razón Social Proveedor</TableHead>
                        <TableHead>Nro. Factura</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha Creación</TableHead>
                        <TableHead>Fecha Emisión</TableHead>
                        <TableHead>Verificar SRI</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        <TableHead>Autorización</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? renderSkeleton() : renderAnulatedTableRows(anulatedRetenciones)}
                    </TableBody>
                  </Table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
      <AlertDialog open={!!retentionToDelete} onOpenChange={(open) => !open && setRetentionToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción es permanente y no se puede deshacer. La retención <strong>{retentionToDelete?.numeroRetencion}</strong> será eliminada de forma definitiva.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRetentionToDelete(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
}
