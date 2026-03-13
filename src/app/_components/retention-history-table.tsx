"use client";

import { useMemo, useState, useEffect } from 'react';
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
import { ExternalLink, FileWarning, Archive, RotateCcw, Trash2, Mail, Send, Copy, Check, FileX, RefreshCw, Clock, Timer } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
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
  const [secondsUntilSync, setSecondsUntilSync] = useState(3600);

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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!activeRetenciones || activeRetenciones.length === 0) {
          setSecondsUntilSync(3600);
          return;
      }
      
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const now = new Date();
      
      let oldestCheckDate = now;
      activeRetenciones.forEach(r => {
          if (!r.lastSriCheck) {
              oldestCheckDate = new Date(0);
          } else {
              const d = (r.lastSriCheck as any).toDate ? (r.lastSriCheck as any).toDate() : new Date(r.lastSriCheck as any);
              if (d < oldestCheckDate) oldestCheckDate = d;
          }
      });

      const elapsedMs = now.getTime() - oldestCheckDate.getTime();
      const remainingMs = Math.max(0, ONE_HOUR_MS - elapsedMs);
      setSecondsUntilSync(Math.floor(remainingMs / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRetenciones]);

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  useEffect(() => {
    if (!activeRetenciones || activeRetenciones.length === 0 || !user?.uid || !firestore) return;
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = new Date();
    
    const staleRetentions = activeRetenciones.filter(r => {
      if (!r.lastSriCheck) return true;
      const lastCheck = (r.lastSriCheck as any).toDate ? (r.lastSriCheck as any).toDate() : new Date(r.lastSriCheck as any);
      return now.getTime() - lastCheck.getTime() > ONE_HOUR_MS;
    });

    if (staleRetentions.length > 0) {
      staleRetentions.sort((a, b) => {
          const dateA = (a.lastSriCheck as any)?.toDate?.() || new Date(a.lastSriCheck as any || 0);
          const dateB = (b.lastSriCheck as any)?.toDate?.() || new Date(b.lastSriCheck as any || 0);
          return dateA.getTime() - dateB.getTime();
      });

      const processNextStale = async () => {
        const itemToUpdate = staleRetentions[0];
        await handleCheckSriStatus(itemToUpdate, true);
      };
      const timer = setTimeout(processNextStale, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeRetenciones, user?.uid, firestore]);

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

  const updateStatusIfNeeded = (retention: RetentionRecord) => {
    if (retention.estado === 'Solicitado' && firestore && user?.uid) {
      const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retention.id);
      updateDocumentNonBlocking(retentionRef, { estado: 'Pendiente Anular' });
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
    const fullFormattedTextForCopy = `Resumen de Retención:\n--------------------------------\n${generateFormattedText(data)}\n--------------------------------`.trim();
    navigator.clipboard.writeText(fullFormattedTextForCopy).then(() => {
      setCopiedId(data.id);
      toast({ title: "Copiado al portapapeles", description: "Los datos de la retención han sido copiados." });
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleBulkShareForVoiding = () => {
    const selectedItems = Object.values(selectedRetentions);
    selectedItems.forEach(item => updateStatusIfNeeded(item));
    const emailBody = selectedItems.map(item => `Detalles de la retención a anular:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`).join('\n\n');
    const subject = "Anulación de Múltiples Retenciones";
    const body = encodeURIComponent(`Buenos días,\n\nFavor su ayuda anulando las retenciones adjuntas.\n\n${emailBody}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleBulkRequestSriAcceptance = () => {
    const selectedItems = Object.values(selectedRetentions);
    selectedItems.forEach(item => updateStatusIfNeeded(item));
    const groupedByProvider = selectedItems.reduce((acc, item) => {
        const key = item.rucProveedor || 'unknown';
        if (!acc[key]) acc[key] = { providerName: item.razonSocialProveedor, ruc: item.rucProveedor, items: [] };
        acc[key].items.push(item);
        return acc;
    }, {} as Record<string, { providerName: string; ruc: string; items: RetentionRecord[] }>);

    Object.values(groupedByProvider).forEach(group => {
        const emailsSet = new Set<string>();
        group.items.forEach(item => {
            const combined = getAllEmailsForProvider(item.rucProveedor, item.emailProveedor);
            combined.split(',').forEach(e => { if(e.trim()) emailsSet.add(e.trim().toLowerCase()); });
        });
        const providerEmails = Array.from(emailsSet).join(',');
        const subject = `Anulación de retenciones`;
        const itemsBody = group.items.map(item => `Detalles de la retención:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`).join('\n\n');
        const emailBody = `Estimados ${group.providerName},\n\nPor medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a las siguientes retenciones:\n\n${itemsBody}\n\nAgradecemos su pronta gestión.`;
        window.open(`mailto:${providerEmails}?subject=${subject}&body=${encodeURIComponent(emailBody)}`);
    });
  };

  const handleShareForVoiding = (data: RetentionRecord) => {
    updateStatusIfNeeded(data);
    const formattedTextForEmail = generateFormattedText(data);
    const subject = "Anulación de Retención";
    const emailBody = `Buenos días,\n\nFavor su ayuda anulando la retención adjunta.\n\nDetalles de la retención a anular:\n--------------------------------\n${formattedTextForEmail}\n--------------------------------\n`;
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleRequestSriAcceptance = (data: RetentionRecord) => {
    updateStatusIfNeeded(data);
    const providerEmails = getAllEmailsForProvider(data.rucProveedor, data.emailProveedor);
    const formattedTextForEmail = generateFormattedText(data);
    const subject = `Anulación retención ${data.numeroRetencion}`;
    const emailBody = `Estimados ${data.razonSocialProveedor},\n\nPor medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a la siguiente retención:\n\nDetalles de la retención:\n--------------------------------\n${formattedTextForEmail}\n--------------------------------\n\nAgradecemos su pronta gestión.\n`;
    window.location.href = `mailto:${providerEmails}?subject=${subject}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleCheckSriStatus = async (item: RetentionRecord, silent = false) => {
    if (!firestore || !user?.uid) return;
    if (!silent) setCheckingSriId(item.id);
    try {
      const sriData = await consultarFacturaSRI(item.numeroAutorizacion);
      const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, item.id);
      updateDocumentNonBlocking(retentionRef, { sriEstado: sriData.estado, sriMensaje: sriData.mensaje || null, lastSriCheck: new Date() });
      if (!silent) toast({ title: 'SRI Actualizado', description: `Estado SRI para ${item.numeroRetencion}: ${sriData.estado}` });
    } catch (err: any) {
      if (!silent) toast({ variant: 'destructive', title: 'Error SRI', description: 'No se pudo consultar el estado del SRI.' });
    } finally {
      if (!silent) setCheckingSriId(null);
    }
  };

  const handleRevertStatus = (retention: RetentionRecord) => {
    if (!firestore || !user?.uid) return;
    let previousStatus: RetentionStatus | null = null;
    if (retention.estado === 'Pendiente Anular') previousStatus = 'Solicitado';
    else if (retention.estado === 'Anulado' || retention.estado === 'No Recibido') previousStatus = 'Pendiente Anular';
    
    if (previousStatus) {
        const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retention.id);
        updateDocumentNonBlocking(retentionRef, { estado: previousStatus });
        toast({ title: 'Estado Revertido', description: `La retención ha vuelto al estado: ${previousStatus}.` });
    }
  };

  const handleDelete = () => {
    if (!firestore || !user?.uid || !retentionToDelete) return;
    const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retentionToDelete.id);
    deleteDocumentNonBlocking(retentionRef);
    toast({ title: 'Retención Eliminada', description: `La retención ha sido eliminada.` });
    setRetentionToDelete(null);
  };
  
  const handleVerifySri = (numeroAutorizacion: string) => {
    navigator.clipboard.writeText(numeroAutorizacion).then(() => {
      toast({ title: 'Copiado al portapapeles', description: 'El número de autorización ha sido copiado.' });
      window.open('https://srienlinea.sri.gob.ec/comprobantes-electronicos-internet/publico/validezComprobantes.jsf?pathMPT=Facturaci%F3n%20Electr%F3nica&actualMPT=Validez%20de%20comprobantes', '_blank', 'noopener,noreferrer');
    });
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return format(d, 'dd/MM/yyyy HH:mm');
  };

  const formatRelativeTime = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return formatDistanceToNow(d, { addSuffix: true, locale: es });
  };

  const getSriStatusColor = (estado?: string) => {
    if (!estado) return "text-muted-foreground";
    const status = estado.toUpperCase();
    if (status === "AUTORIZADO") return "text-foreground";
    if (status === "POR PROCESAR" || status === "RECIBIDO" || status.includes("PENDIENTE")) return "text-orange-500";
    if (status === "ANULADO" || status === "CANCELADO") return "text-emerald-600";
    if (status.includes("RECHAZADO") || status.includes("ERROR") || status.includes("NO AUTORIZADO")) return "text-destructive";
    return "text-foreground";
  };

  const renderTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) return <TableRow><TableCell colSpan={13} className="h-24 text-center">No hay retenciones activas.</TableCell></TableRow>;
    return items.map((item: RetentionRecord) => {
      const isUsed = item.estado !== 'Solicitado';
      return (
        <TableRow key={item.id} data-state={selectedRetentions[item.id] ? 'selected' : ''}>
          <TableCell className="p-2"><Checkbox checked={!!selectedRetentions[item.id]} onCheckedChange={(value) => handleSelectRetention(item, !!value)} /></TableCell>
          <TableCell className="p-2">
              <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleShareForVoiding(item)} 
                        disabled={selectedCount > 0}
                        className={cn(isUsed && "opacity-60")}
                      >
                        <Mail className={cn("h-4 w-4", isUsed && "text-muted-foreground")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Email para Anular</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRequestSriAcceptance(item)} 
                        disabled={selectedCount > 0}
                        className={cn(isUsed && "opacity-60")}
                      >
                        <Send className={cn("h-4 w-4", isUsed && "text-muted-foreground")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Solicitar Aceptación SRI</p></TooltipContent>
                  </Tooltip>
                  <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => handleCopy(item)}><Check className={cn("h-4 w-4", copiedId === item.id ? "text-green-500" : "opacity-0")} /><Copy className={cn("h-4 w-4 absolute", copiedId === item.id && "opacity-0")} /></Button></TooltipTrigger><TooltipContent><p>Copiar Datos</p></TooltipContent></Tooltip>
              </div>
          </TableCell>
          <TableCell className="font-mono p-2">{item.numeroRetencion}</TableCell>
          <TableCell className="font-medium p-2 w-[250px] truncate">{item.razonSocialProveedor}</TableCell>
          <TableCell className="p-2 w-[100px]">{item.numeroFactura}</TableCell>
          <TableCell className="font-mono text-right p-2 w-[120px]">{item.valorRetencion}</TableCell>
          <TableCell className="p-2 w-[240px]">
            <div className="flex flex-col items-center justify-center gap-1 text-center">
              <div className={cn("text-lg font-bold uppercase tracking-tight leading-none", getSriStatusColor(item.sriEstado))}>
                {item.sriEstado || "NO CONSULTADO"}
              </div>
              <div className={cn("text-[10px] flex items-center justify-center gap-1 font-medium", getSriStatusColor(item.sriEstado))}>
                <Clock className="h-2.5 w-2.5" />
                {item.lastSriCheck ? formatRelativeTime(item.lastSriCheck) : 'Nunca verificado'}
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 mt-1 w-fit" onClick={() => handleCheckSriStatus(item)} disabled={checkingSriId === item.id}>
                {checkingSriId === item.id ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5 mr-1" />}
                ACTUALIZAR SRI
              </Button>
            </div>
          </TableCell>
          <TableCell className="p-2 w-[150px] text-center"><StatusSelector retention={item} /></TableCell>
          <TableCell className="p-2 w-[130px] text-xs text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
          <TableCell className="p-2 w-[100px] text-xs">{item.fechaEmision}</TableCell>
          <TableCell className="p-2 w-[120px]"><Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleVerifySri(item.numeroAutorizacion)}><ExternalLink className="mr-1 h-3 w-3" />VERIFICAR</Button></TableCell>
          <TableCell className="p-2 w-[80px] text-center">
              <div className="flex items-center justify-center gap-1">
                  {item.estado !== 'Solicitado' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRevertStatus(item)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Revertir Estado</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setRetentionToDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
              </div>
          </TableCell>
          <TableCell className="p-2"><span className="font-mono text-[9px] text-muted-foreground break-all">{item.numeroAutorizacion}</span></TableCell>
        </TableRow>
      );
    });
  };

  const renderArchivedTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) return <TableRow><TableCell colSpan={13} className="h-24 text-center">No hay registros en esta sección.</TableCell></TableRow>;
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id}>
         <TableCell className="p-2">
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleShareForVoiding(item)}><Mail className="h-3.5 w-3.5" /></Button>
             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRequestSriAcceptance(item)}><Send className="h-3.5 w-3.5" /></Button>
           </div>
         </TableCell>
        <TableCell className="font-mono p-2 text-xs">{item.numeroRetencion}</TableCell>
        <TableCell className="font-medium p-2 text-xs truncate max-w-[150px]">{item.razonSocialProveedor}</TableCell>
        <TableCell className="p-2 text-xs">{item.numeroFactura}</TableCell>
        <TableCell className="font-mono text-right p-2 text-xs">{item.valorRetencion}</TableCell>
        <TableCell className="p-2 w-[180px]">
          <div className={cn("text-xs font-bold uppercase text-center", getSriStatusColor(item.sriEstado))}>
            {item.sriEstado || "N/A"}
          </div>
        </TableCell>
        <TableCell className="p-2 text-center"><StatusBadge status={item.estado} /></TableCell>
        <TableCell className="p-2 text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
        <TableCell className="p-2 text-[10px]">{item.fechaEmision}</TableCell>
        <TableCell className="p-2">
            <Button size="sm" variant="outline" className="text-[10px] h-6 px-1" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                VERIFICAR
            </Button>
        </TableCell>
        <TableCell className="p-2 text-center">
            <div className="flex items-center justify-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRevertStatus(item)}>
                    <RotateCcw className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setRetentionToDelete(item)}>
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>
        </TableCell>
        <TableCell className="p-2"><span className="font-mono text-[9px] text-muted-foreground break-all">{item.numeroAutorizacion}</span></TableCell>
      </TableRow>
    ));
  }

  return (
    <TooltipProvider>
    <Card className="w-full relative overflow-hidden">
      <div className="absolute top-4 right-6 flex items-center gap-2 text-[11px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
        <Timer className="h-3 w-3" />
        Sincro SRI en: {formatCountdown(secondsUntilSync)}
      </div>
      <CardHeader className="pb-4">
        <CardTitle>Seguimiento de Anulaciones</CardTitle>
        <CardDescription>Sincroniza el estado del SRI y gestiona la aceptación de anulación por parte del proveedor.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive" className="mb-4"><FileWarning className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error.message}</AlertDescription></Alert>}
        <div className="flex items-center gap-4 mb-4">
            <Button onClick={handleBulkShareForVoiding} disabled={selectedCount === 0} size="sm"><Mail className="mr-2 h-4 w-4" />Email Anular ({selectedCount})</Button>
            <Button onClick={handleBulkRequestSriAcceptance} disabled={selectedCount === 0} size="sm"><Send className="mr-2 h-4 w-4" />Aceptación SRI ({selectedCount})</Button>
        </div>
        <div className="border rounded-lg mb-6 overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[40px] p-2"><Checkbox checked={selectedCount > 0 && selectedCount === activeRetenciones.length} onCheckedChange={(value) => handleSelectAll(!!value)} /></TableHead>
                <TableHead className="p-2 w-[120px]">Gestión</TableHead>
                <TableHead className="p-2 w-[150px]">Nro. Retención</TableHead>
                <TableHead className="p-2 w-[250px]">Proveedor</TableHead>
                <TableHead className="p-2 w-[100px]">Factura</TableHead>
                <TableHead className="text-right p-2 w-[120px]">Valor Reten.</TableHead>
                <TableHead className="p-2 w-[240px] text-center">Estado SRI & Sincro</TableHead>
                <TableHead className="p-2 w-[150px] text-center">Estado App</TableHead>
                <TableHead className="p-2 w-[130px]">F. Registro</TableHead>
                <TableHead className="p-2 w-[100px]">F. Emisión</TableHead>
                <TableHead className="p-2 w-[120px]">SRI En Línea</TableHead>
                <TableHead className="text-center p-2 w-[80px]">Ops</TableHead>
                <TableHead className="p-2">Autorización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{loading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={13}><Skeleton className="h-10 w-full" /></TableCell></TableRow>) : renderTableRows(activeRetenciones)}</TableBody>
          </Table>
        </div>

        <div className="space-y-3">
          {noRecibidoRetenciones.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="no-recibidas" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FileX className="h-4 w-4 text-destructive" />
                    <span>Retenciones No Recibidas ({noRecibidoRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border rounded-lg mt-2 bg-background">
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
              <AccordionItem value="anuladas" className="border rounded-lg px-4 bg-muted/20">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <span>Retenciones Anuladas ({anulatedRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="border rounded-lg mt-2 bg-background">
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
                    La retención <strong>{retentionToDelete?.numeroRetencion}</strong> de <strong>{retentionToDelete?.razonSocialProveedor}</strong> será eliminada permanentemente del historial.
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
