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
import { ExternalLink, FileWarning, Archive, RotateCcw, Trash2, Mail, Send, Copy, Check, FileX, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { RetentionRecord, RetentionStatus } from '@/lib/types';
import { StatusSelector } from './status-selector';
import { StatusBadge } from './status-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getAllEmailsForProvider } from '@/lib/provider-emails';
import { consultarFacturaSRI } from '@/lib/sri-service';
import { cn } from '@/lib/utils';

const formatDisplayKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      numeroRetencion: "Nro. Retención",
      numeroAutorizacion: "Autorización",
      razonSocialProveedor: "Razón Social Proveedor",
      rucProveedor: "RUC Proveedor",
      emailProveedor: "Email Proveedor",
      numeroFactura: "Nro. Factura",
      fechaEmision: "Fecha Emisión",
      valorRetencion: "Valor Retenido",
    };
    return keyMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

const desiredOrder: (keyof RetentionRecord)[] = [
    'numeroRetencion',
    'numeroAutorizacion',
    'razonSocialProveedor',
    'rucProveedor',
    'emailProveedor',
    'numeroFactura',
    'fechaEmision',
    'valorRetencion'
];

export function RetentionHistoryTable() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [retentionToDelete, setRetentionToDelete] = useState<RetentionRecord | null>(null);
  const [selectedRetentions, setSelectedRetentions] = useState<Record<string, RetentionRecord>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checkingSriId, setCheckingSriId] = useState<string | null>(null);

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

  const { activeRetenciones, anulatedRetenciones, noRecibidoRetenciones } = useMemo(() => {
    const active = retenciones?.filter(r => r.estado !== 'Anulado' && r.estado !== 'No Recibido') || [];
    const anulated = retenciones?.filter(r => r.estado === 'Anulado') || [];
    const noRecibido = retenciones?.filter(r => r.estado === 'No Recibido') || [];
    return { activeRetenciones: active, anulatedRetenciones: anulated, noRecibidoRetenciones: noRecibido };
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
          if (value !== undefined && value !== null && value !== '') {
              return `${formatDisplayKey(key)}: ${value}`;
          }
          return null;
      })
      .filter(Boolean)
      .join('\n');
  }

  const handleCopy = (data: RetentionRecord) => {
    const fullFormattedTextForCopy = `
Resumen de Retención:
--------------------------------
${generateFormattedText(data)}
--------------------------------
  `.trim();

    navigator.clipboard.writeText(fullFormattedTextForCopy).then(() => {
      setCopiedId(data.id);
      toast({
        title: "Copiado al portapapeles",
        description: "Los datos de la retención han sido copiados.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

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
                ruc: item.rucProveedor,
                items: []
            };
        }
        acc[key].items.push(item);
        return acc;
    }, {} as Record<string, { providerName: string; ruc: string; items: RetentionRecord[] }>);

    Object.values(groupedByProvider).forEach(group => {
        const emailsSet = new Set<string>();
        group.items.forEach(item => {
            const combined = getAllEmailsForProvider(item.rucProveedor, item.emailProveedor);
            combined.split(',').forEach(e => {
                if(e.trim()) emailsSet.add(e.trim().toLowerCase());
            });
        });
        
        const providerEmails = Array.from(emailsSet).join(',');
        const subject = `Anulación de retenciones`;
        const itemsBody = group.items.map(item => 
            `Detalles de la retención:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`
        ).join('\n\n');
        
        const emailBody = `Estimados ${group.providerName},\n\nPor medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a las siguientes retenciones:\n\n${itemsBody}\n\nAgradecemos su pronta gestión.`;
        
        const body = encodeURIComponent(emailBody);
        window.open(`mailto:${providerEmails}?subject=${subject}&body=${body}`);
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
    const providerEmails = getAllEmailsForProvider(data.rucProveedor, data.emailProveedor);
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
    window.location.href = `mailto:${providerEmails}?subject=${subject}&body=${body}`;
  };

  const handleCheckSriStatus = async (item: RetentionRecord) => {
    if (!firestore || !user?.uid) return;
    
    setCheckingSriId(item.id);
    try {
      const sriData = await consultarFacturaSRI(item.numeroAutorizacion);
      const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, item.id);
      
      updateDocumentNonBlocking(retentionRef, { 
        sriEstado: sriData.estado,
        sriMensaje: sriData.mensaje || null,
        lastSriCheck: new Date()
      });

      toast({
        title: 'SRI Actualizado',
        description: `Estado SRI para ${item.numeroRetencion}: ${sriData.estado}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error SRI',
        description: 'No se pudo consultar el estado del SRI en este momento.',
      });
    } finally {
      setCheckingSriId(null);
    }
  };

  const handleRevertStatus = (retention: RetentionRecord) => {
    if (!firestore || !user?.uid) return;

    let previousStatus: RetentionStatus | null = null;
    if (retention.estado === 'Pendiente Anular') {
      previousStatus = 'Solicitado';
    } else if (retention.estado === 'Anulado' || retention.estado === 'No Recibido') {
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
    if (date.toDate) return format(date.toDate(), 'dd/MM/yyyy HH:mm');
    try {
      return format(new Date(date), 'dd/MM/yyyy HH:mm');
    } catch {
      return 'Fecha inválida';
    }
  };

  const getSriStatusColor = (estado?: string) => {
    if (!estado) return "text-muted-foreground";
    const status = estado.toUpperCase();
    if (status === "AUTORIZADO") return "text-green-600 font-bold";
    if (status === "POR PROCESAR") return "text-yellow-600 font-bold";
    if (status === "NO AUTORIZADO" || status === "RECHAZADO" || status === "FUERA DE RANGO") return "text-destructive font-bold";
    return "text-foreground font-semibold";
  };

  const renderSkeleton = () =>
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={i}>
        <TableCell className="p-2"><Skeleton className="h-4 w-4" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-9 w-24" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-40" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-6 w-24" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-28" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-9 w-32" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="py-2 px-2"><Skeleton className="h-4 w-32" /></TableCell>
      </TableRow>
    ));

  const renderTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={13} className="h-24 text-center">
            No hay retenciones en esta categoría.
          </TableCell>
        </TableRow>
      );
    }
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id} data-state={selectedRetentions[item.id] ? 'selected' : ''}>
        <TableCell className="p-2">
            <Checkbox
                checked={!!selectedRetentions[item.id]}
                onCheckedChange={(value) => handleSelectRetention(item, !!value)}
                aria-label="Seleccionar retención"
            />
        </TableCell>
        <TableCell className="p-2">
            <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleShareForVoiding(item)} disabled={selectedCount > 0}>
                            <Mail className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Email para Anular</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleRequestSriAcceptance(item)} disabled={selectedCount > 0}>
                            <Send className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Solicitar Aceptación SRI</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleCopy(item)}>
                            {copiedId === item.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copiar Datos</p></TooltipContent>
                </Tooltip>
            </div>
        </TableCell>
        <TableCell className="font-mono p-2">{item.numeroRetencion}</TableCell>
        <TableCell className="font-medium p-2 w-[250px] truncate">{item.razonSocialProveedor}</TableCell>
        <TableCell className="p-2 w-[100px]">{item.numeroFactura}</TableCell>
        <TableCell className="font-mono text-right p-2 w-[140px]">{item.valorRetencion}</TableCell>
        <TableCell className="p-2 w-[150px]"><StatusSelector retention={item} /></TableCell>
        <TableCell className="p-2 w-[150px]">
          <div className="flex flex-col gap-1">
            <div className={cn("text-xs uppercase truncate", getSriStatusColor(item.sriEstado))}>
              {item.sriEstado || "NO CONSULTADO"}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-[10px] px-2"
              onClick={() => handleCheckSriStatus(item)}
              disabled={checkingSriId === item.id}
            >
              {checkingSriId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              ACTUALIZAR SRI
            </Button>
          </div>
        </TableCell>
        <TableCell className="p-2 w-[140px] text-xs">{formatDate(item.createdAt)}</TableCell>
        <TableCell className="p-2 w-[100px] text-xs">{item.fechaEmision}</TableCell>
        <TableCell className="p-2 w-[140px]">
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                <ExternalLink className="mr-1 h-3 w-3" />
                VERIFICAR
            </Button>
        </TableCell>
        <TableCell className="p-2 w-[100px] text-center">
          <div className="flex items-center justify-center gap-1">
            {item.estado !== 'Solicitado' && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRevertStatus(item)}>
                  <RotateCcw className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRetentionToDelete(item)}>
                <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
        <TableCell className="p-2"><span className="font-mono text-[10px] break-all">{item.numeroAutorizacion}</span></TableCell>
      </TableRow>
    ));
  };
  
  const renderArchivedTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={13} className="h-24 text-center">
            No hay retenciones en esta categoría.
          </TableCell>
        </TableRow>
      );
    }
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id}>
         <TableCell className="p-2">
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShareForVoiding(item)}><Mail className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRequestSriAcceptance(item)}><Send className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(item)}>
                    {copiedId === item.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
            </div>
        </TableCell>
        <TableCell className="font-mono p-2">{item.numeroRetencion}</TableCell>
        <TableCell className="font-medium p-2 w-[250px] truncate">{item.razonSocialProveedor}</TableCell>
        <TableCell className="p-2 w-[100px]">{item.numeroFactura}</TableCell>
        <TableCell className="font-mono text-right p-2 w-[140px]">{item.valorRetencion}</TableCell>
        <TableCell className="p-2 w-[150px]"><StatusBadge status={item.estado} /></TableCell>
        <TableCell className="p-2 w-[150px]">
          <div className="flex flex-col gap-1">
            <div className={cn("text-xs uppercase truncate", getSriStatusColor(item.sriEstado))}>
              {item.sriEstado || "NO CONSULTADO"}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-[10px] px-2"
              onClick={() => handleCheckSriStatus(item)}
              disabled={checkingSriId === item.id}
            >
              {checkingSriId === item.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              ACTUALIZAR SRI
            </Button>
          </div>
        </TableCell>
        <TableCell className="p-2 w-[140px] text-xs">{formatDate(item.createdAt)}</TableCell>
        <TableCell className="p-2 w-[100px] text-xs">{item.fechaEmision}</TableCell>
        <TableCell className="p-2 w-[140px]">
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                <ExternalLink className="mr-1 h-3 w-3" />
                VERIFICAR
            </Button>
        </TableCell>
        <TableCell className="p-2 w-[100px] text-center">
            <div className="flex items-center justify-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleRevertStatus(item)}><RotateCcw className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRetentionToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
            </div>
        </TableCell>
        <TableCell className="p-2"><span className="font-mono text-[10px] break-all">{item.numeroAutorizacion}</span></TableCell>
      </TableRow>
    ));
  }

  return (
    <TooltipProvider>
    <Card className="w-full max-w-full">
      <CardHeader>
        <CardTitle>Historial de Retenciones</CardTitle>
        <CardDescription>
          Gestiona tus documentos y sincroniza su estado real con el SRI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center gap-4 mb-4">
            <Button onClick={handleBulkShareForVoiding} disabled={selectedCount === 0} size="sm">
                <Mail className="mr-2 h-4 w-4" />
                Email Anular ({selectedCount})
            </Button>
            <Button onClick={handleBulkRequestSriAcceptance} disabled={selectedCount === 0} size="sm">
                <Send className="mr-2 h-4 w-4" />
                Aceptación SRI ({selectedCount})
            </Button>
        </div>

        <div className="border rounded-lg mb-4 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[40px] p-2">
                  <Checkbox
                    checked={selectedCount > 0 && selectedCount === activeRetenciones.length}
                    onCheckedChange={(value) => handleSelectAll(!!value)}
                    aria-label="Seleccionar todo"
                  />
                </TableHead>
                <TableHead className="p-2 w-[120px]">Acciones</TableHead>
                <TableHead className="p-2 w-[150px]">Nro. Retención</TableHead>
                <TableHead className="p-2 w-[250px]">Proveedor</TableHead>
                <TableHead className="p-2 w-[100px]">Factura</TableHead>
                <TableHead className="text-right p-2 w-[140px]">Valor Reten.</TableHead>
                <TableHead className="p-2 w-[150px]">Estado App</TableHead>
                <TableHead className="p-2 w-[150px]">Estado SRI</TableHead>
                <TableHead className="p-2 w-[140px]">Creación</TableHead>
                <TableHead className="p-2 w-[100px]">Emisión</TableHead>
                <TableHead className="p-2 w-[140px]">Validación</TableHead>
                <TableHead className="text-center p-2 w-[100px]">Mantenim.</TableHead>
                <TableHead className="p-2">Autorización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? renderSkeleton() : renderTableRows(activeRetenciones)}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4">
          {noRecibidoRetenciones.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="no-recibidas" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FileX className="h-4 w-4 text-destructive" />
                    <span>Retenciones No Recibidas ({noRecibidoRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border rounded-lg mt-2">
                    <Table>
                      <TableBody>
                        {renderArchivedTableRows(noRecibidoRetenciones)}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {anulatedRetenciones.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="anuladas" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <span>Retenciones Anuladas ({anulatedRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border rounded-lg mt-2">
                    <Table>
                      <TableBody>
                        {renderArchivedTableRows(anulatedRetenciones)}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>

    <AlertDialog open={!!retentionToDelete} onOpenChange={(open) => !open && setRetentionToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar retención?</AlertDialogTitle>
          <AlertDialogDescription>
            La retención <strong>{retentionToDelete?.numeroRetencion}</strong> será eliminada permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setRetentionToDelete(null)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
}
