
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
import { ExternalLink, FileWarning, Archive, RotateCcw, Trash2, Mail, Send, Copy, CheckCircle2, RefreshCw, Clock, Timer, FileX } from 'lucide-react';
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
  const [secondsUntilSync, setSecondsUntilSync] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    if (!isMounted) return;
    
    const interval = setInterval(() => {
      if (!activeRetenciones || activeRetenciones.length === 0) {
          setSecondsUntilSync(0);
          return;
      }
      
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const now = new Date();
      
      let oldestCheckDate = now;
      let foundCheck = false;

      activeRetenciones.forEach(r => {
          if (!r.lastSriCheck) {
              oldestCheckDate = new Date(0); 
              foundCheck = true;
          } else {
              const d = (r.lastSriCheck as any).toDate ? (r.lastSriCheck as any).toDate() : new Date(r.lastSriCheck as any);
              if (!foundCheck || d < oldestCheckDate) {
                  oldestCheckDate = d;
                  foundCheck = true;
              }
          }
      });

      if (!foundCheck) {
          setSecondsUntilSync(0);
          return;
      }

      const elapsedMs = now.getTime() - oldestCheckDate.getTime();
      const remainingMs = Math.max(0, ONE_HOUR_MS - elapsedMs);
      setSecondsUntilSync(Math.floor(remainingMs / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRetenciones, isMounted]);

  const formatCountdown = (seconds: number) => {
    if (seconds === 0 && (!activeRetenciones || activeRetenciones.length === 0)) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isMounted || !activeRetenciones || activeRetenciones.length === 0 || !user?.uid || !firestore) return;
    
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = new Date();
    
    const staleRetentions = activeRetenciones.filter(r => {
      if (!r.lastSriCheck) return true;
      const lastCheck = (r.lastSriCheck as any).toDate ? (r.lastSriCheck as any).toDate() : new Date(r.lastSriCheck as any);
      return now.getTime() - lastCheck.getTime() >= ONE_HOUR_MS;
    });

    if (staleRetentions.length > 0) {
      const batchToUpdate = staleRetentions
        .sort((a, b) => {
          const dateA = (a.lastSriCheck as any)?.toDate?.() || new Date(a.lastSriCheck as any || 0);
          const dateB = (b.lastSriCheck as any)?.toDate?.() || new Date(b.lastSriCheck as any || 0);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 5);

      const processSyncBatch = async () => {
        await Promise.all(batchToUpdate.map(item => handleCheckSriStatus(item, true)));
      };

      const timer = setTimeout(processSyncBatch, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeRetenciones, user?.uid, firestore, isMounted]);

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

  const updateStatusAndMarkAction = (retention: RetentionRecord, action: 'email' | 'acceptance') => {
    if (!firestore || !user?.uid) return;
    const retentionRef = doc(firestore, `users/${user.uid}/retenciones`, retention.id);
    const updateData: any = {};
    if (retention.estado === 'Solicitado') updateData.estado = 'Pendiente Anular';
    if (action === 'email') updateData.emailAnularSent = true;
    if (action === 'acceptance') updateData.sriAcceptanceRequested = true;

    if (Object.keys(updateData).length > 0) {
      updateDocumentNonBlocking(retentionRef, updateData);
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
    selectedItems.forEach(item => updateStatusAndMarkAction(item, 'email'));
    const emailBody = selectedItems.map(item => `Detalles de la retención a anular:\n--------------------------------\n${generateFormattedText(item)}\n--------------------------------`).join('\n\n');
    const subject = "Anulación de Múltiples Retenciones";
    const body = encodeURIComponent(`Buenos días,\n\nFavor su ayuda anulando las retenciones adjuntas.\n\n${emailBody}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleBulkRequestSriAcceptance = () => {
    const selectedItems = Object.values(selectedRetentions);
    selectedItems.forEach(item => updateStatusAndMarkAction(item, 'acceptance'));
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
    updateStatusAndMarkAction(data, 'email');
    const formattedTextForEmail = generateFormattedText(data);
    const subject = "Anulación de Retención";
    const emailBody = `Buenos días,\n\nFavor su ayuda anulando la retención adjunta.\n\nDetalles de la retención a anular:\n--------------------------------\n${formattedTextForEmail}\n--------------------------------\n`;
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(emailBody)}`;
  };

  const handleRequestSriAcceptance = (data: RetentionRecord) => {
    updateStatusAndMarkAction(data, 'acceptance');
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
        updateDocumentNonBlocking(retentionRef, { 
          estado: previousStatus,
          emailAnularSent: false,
          sriAcceptanceRequested: false
        });
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
    if (status === "POR PROCESAR" || status === "RECIBIDO" || status.includes("PENDIENTE")) return "text-orange-600";
    if (status === "ANULADO" || status === "CANCELADO") return "text-emerald-600";
    if (status.includes("RECHAZADO") || status.includes("ERROR") || status.includes("NO AUTORIZADO")) return "text-destructive font-bold";
    return "text-foreground";
  };

  const renderTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) return <TableRow><TableCell colSpan={13} className="h-48 text-center text-muted-foreground italic">No hay retenciones activas para mostrar.</TableCell></TableRow>;
    return items.map((item: RetentionRecord) => {
      return (
        <TableRow key={item.id} className={cn("transition-colors", selectedRetentions[item.id] ? "bg-primary/[0.03]" : "hover:bg-muted/30")}>
          <TableCell className="p-2"><Checkbox checked={!!selectedRetentions[item.id]} onCheckedChange={(value) => handleSelectRetention(item, !!value)} className="rounded" /></TableCell>
          <TableCell className="p-2">
              <div className="flex items-center gap-1.5 px-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleShareForVoiding(item)} 
                        disabled={selectedCount > 0}
                        className={cn("h-8 w-8 rounded-lg transition-colors", item.emailAnularSent ? "opacity-30" : "hover:bg-blue-50")}
                      >
                        <Mail className={cn("h-5 w-5", !item.emailAnularSent ? "text-blue-600" : "text-slate-400")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Email para Anular</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRequestSriAcceptance(item)} 
                        disabled={selectedCount > 0}
                        className={cn("h-8 w-8 rounded-lg transition-colors", item.sriAcceptanceRequested ? "opacity-30" : "hover:bg-violet-50")}
                      >
                        <Send className={cn("h-5 w-5", !item.sriAcceptanceRequested ? "text-violet-700" : "text-slate-400")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Solicitar Aceptación SRI</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleCopy(item)}>
                            {copiedId === item.id ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Copiar Datos</p></TooltipContent>
                  </Tooltip>
              </div>
          </TableCell>
          <TableCell className="font-mono font-bold p-2 text-sm w-[160px] whitespace-nowrap">{item.numeroRetencion}</TableCell>
          <TableCell className="font-semibold p-2 w-[150px]"><div className="truncate text-sm" title={item.razonSocialProveedor}>{item.razonSocialProveedor}</div></TableCell>
          <TableCell className="p-2 w-[110px] font-medium text-muted-foreground text-sm">{item.numeroFactura}</TableCell>
          <TableCell className="font-mono font-bold text-right p-2 w-[110px] text-primary text-sm">{item.valorRetencion}</TableCell>
          <TableCell className="p-2 w-[220px]">
            <div className="flex flex-col items-center justify-center gap-1.5 py-2 px-3 bg-muted/30 rounded-xl border border-border/60 shadow-sm min-h-[70px]">
              <div className={cn("text-sm font-black uppercase tracking-widest leading-none", getSriStatusColor(item.sriEstado))}>
                {item.sriEstado || "NO CONSULTADO"}
              </div>
              <div className={cn("text-[11px] flex items-center justify-center gap-1 font-bold opacity-80", getSriStatusColor(item.sriEstado))}>
                <Clock className="h-3 w-3" />
                {isMounted ? (item.lastSriCheck ? formatRelativeTime(item.lastSriCheck) : 'Sin fecha') : '...'}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] font-bold px-2 rounded-md bg-background border-border/80 hover:border-primary/50 transition-all mt-1" onClick={() => handleCheckSriStatus(item)} disabled={checkingSriId === item.id}>
                    {checkingSriId === item.id ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5 mr-1.5" />}
                    SINCRONIZAR
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Revisar autorización en el SRI</p></TooltipContent>
              </Tooltip>
            </div>
          </TableCell>
          <TableCell className="p-2 w-[140px] text-center"><StatusSelector retention={item} /></TableCell>
          <TableCell className="p-2 w-[120px] text-[11px] font-medium text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
          <TableCell className="p-2 w-[100px] text-[11px] font-medium">{item.fechaEmision}</TableCell>
          <TableCell className="p-2 w-[115px] text-center"><Button size="sm" variant="ghost" className="text-[10px] h-8 px-2 font-bold border border-dashed border-primary/20 hover:border-primary/40 rounded-lg" onClick={() => handleVerifySri(item.numeroAutorizacion)}><ExternalLink className="mr-1 h-3.5 w-3.5" />WEB SRI</Button></TableCell>
          <TableCell className="p-2 w-[90px] text-center">
              <div className="flex items-center justify-center gap-1.5">
                  {(item.estado !== 'Solicitado' || item.emailAnularSent || item.sriAcceptanceRequested) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-orange-50 text-orange-600" onClick={() => handleRevertStatus(item)}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top"><p>Revertir Estado</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-destructive/60 hover:text-destructive hover:bg-destructive/5" onClick={() => setRetentionToDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
              </div>
          </TableCell>
          <TableCell className="p-2"><div className="font-mono text-[9px] text-muted-foreground/60 break-all leading-tight max-w-[120px]">{item.numeroAutorizacion}</div></TableCell>
        </TableRow>
      );
    });
  };

  const renderArchivedTableRows = (items: RetentionRecord[]) => {
    if (items.length === 0) return <TableRow><TableCell colSpan={13} className="h-24 text-center italic text-muted-foreground">Nada que mostrar aquí.</TableCell></TableRow>;
    return items.map((item: RetentionRecord) => (
      <TableRow key={item.id} className="opacity-70 hover:opacity-100 transition-opacity">
         <TableCell className="p-2">
           <div className="flex items-center gap-1.5 px-2">
             <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleShareForVoiding(item)}><Mail className="h-4 w-4 text-blue-600" /></Button>
             <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleRequestSriAcceptance(item)}><Send className="h-4 w-4 text-violet-700" /></Button>
           </div>
         </TableCell>
        <TableCell className="font-mono p-2 text-[12px] font-bold whitespace-nowrap">{item.numeroRetencion}</TableCell>
        <TableCell className="font-semibold p-2 text-[12px] truncate max-w-[150px]">{item.razonSocialProveedor}</TableCell>
        <TableCell className="p-2 text-[12px] text-muted-foreground">{item.numeroFactura}</TableCell>
        <TableCell className="font-mono font-bold text-right p-2 text-[12px]">{item.valorRetencion}</TableCell>
        <TableCell className="p-2 w-[180px]">
          <div className={cn("text-[11px] font-black uppercase text-center py-1 px-3 rounded-full bg-muted/40", getSriStatusColor(item.sriEstado))}>
            {item.sriEstado || "N/A"}
          </div>
        </TableCell>
        <TableCell className="p-2 text-center"><StatusBadge status={item.estado} /></TableCell>
        <TableCell className="p-2 text-[11px] font-medium text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
        <TableCell className="p-2 text-[11px] font-medium">{item.fechaEmision}</TableCell>
        <TableCell className="p-2 text-center">
            <Button size="sm" variant="outline" className="text-[10px] h-7 px-2 font-bold rounded-lg" onClick={() => handleVerifySri(item.numeroAutorizacion)}>
                SRI
            </Button>
        </TableCell>
        <TableCell className="p-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => handleRevertStatus(item)}>
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-destructive" onClick={() => setRetentionToDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </TableCell>
        <TableCell className="p-2"><div className="font-mono text-[9px] text-muted-foreground/50 break-all">{item.numeroAutorizacion}</div></TableCell>
      </TableRow>
    ));
  }

  return (
    <TooltipProvider>
    <Card className="w-full relative overflow-visible border-2 shadow-xl rounded-2xl bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-3 pt-5 border-b relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-3xl font-black tracking-tight">Seguimiento de Anulaciones</CardTitle>
            <CardDescription className="text-base font-semibold opacity-70">Sincroniza y gestiona comunicación con proveedores.</CardDescription>
          </div>
          <div className="flex items-center gap-6 text-xs font-black text-primary bg-primary/10 border-2 border-primary/20 px-8 py-5 rounded-[1.5rem] shadow-md animate-in zoom-in duration-500">
            <Timer className="h-9 w-9" />
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-widest opacity-60">Sincronizando con SRI en:</span>
              <span className="text-3xl font-mono leading-none mt-1.5">{isMounted ? formatCountdown(secondsUntilSync) : '00:00:00'}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-2 sm:px-4">
        {error && <Alert variant="destructive" className="mb-4 rounded-xl border-2"><FileWarning className="h-4 w-4" /><AlertTitle className="font-bold text-xs">Error de Red</AlertTitle><AlertDescription className="text-xs">{error.message}</AlertDescription></Alert>}
        
        <div className={cn(
          "flex items-center gap-3 mb-4 p-2 bg-muted/40 border-2 border-primary/10 rounded-xl transition-all shadow-sm",
          selectedCount > 0 ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none h-0 p-0 mb-0 overflow-hidden"
        )}>
            <div className="text-[11px] font-black text-muted-foreground uppercase tracking-widest px-3 border-r-2 border-border/50">Seleccionados ({selectedCount})</div>
            <div className="flex gap-2">
              <Button onClick={handleBulkShareForVoiding} size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all text-[11px] px-4 font-black"><Mail className="mr-2 h-4 w-4" />Email Anular</Button>
              <Button onClick={handleBulkRequestSriAcceptance} size="sm" className="h-8 bg-violet-700 hover:bg-violet-800 text-white rounded-xl shadow-md transition-all text-[11px] px-4 font-black"><Send className="mr-2 h-4 w-4" />Aceptación SRI</Button>
            </div>
            <Button onClick={() => setSelectedRetentions({})} variant="ghost" size="sm" className="h-8 text-[10px] font-black rounded-xl ml-auto hover:bg-background/80">Limpiar Selección</Button>
        </div>

        <div className="border rounded-2xl mb-6 overflow-visible shadow-sm bg-background/60">
          <Table className="min-w-[1000px]">
            <TableHeader className="bg-muted/50 border-b">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[45px] p-2 text-center"><Checkbox checked={isMounted && selectedCount > 0 && selectedCount === activeRetenciones.length} onCheckedChange={(value) => handleSelectAll(!!value)} className="rounded" /></TableHead>
                <TableHead className="p-2 w-[125px] font-black text-[10px] uppercase tracking-widest px-4">Acciones</TableHead>
                <TableHead className="p-2 w-[160px] font-black text-[10px] uppercase tracking-widest">Retención</TableHead>
                <TableHead className="p-2 w-[150px] font-black text-[10px] uppercase tracking-widest">Proveedor</TableHead>
                <TableHead className="p-2 w-[115px] font-black text-[10px] uppercase tracking-widest">Factura</TableHead>
                <TableHead className="text-right p-2 w-[115px] font-black text-[10px] uppercase tracking-widest">Valor</TableHead>
                <TableHead className="p-2 w-[220px] text-center font-black text-[10px] uppercase tracking-widest">SRI Status</TableHead>
                <TableHead className="p-2 w-[140px] text-center font-black text-[10px] uppercase tracking-widest">App Status</TableHead>
                <TableHead className="p-2 w-[125px] font-black text-[10px] uppercase tracking-widest">Registro</TableHead>
                <TableHead className="p-2 w-[105px] font-black text-[10px] uppercase tracking-widest">Emisión</TableHead>
                <TableHead className="p-2 w-[115px] font-black text-[10px] uppercase tracking-widest text-center">Consultas</TableHead>
                <TableHead className="text-center p-2 w-[95px] font-black text-[10px] uppercase tracking-widest">Ops</TableHead>
                <TableHead className="p-2 font-black text-[10px] uppercase tracking-widest min-w-[125px]">Autorización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-background/20 backdrop-blur-sm">
              {loading || !isMounted ? Array.from({ length: 4 }).map((_, i) => <TableRow key={i}><TableCell colSpan={13}><Skeleton className="h-14 w-full my-1 rounded-xl" /></TableCell></TableRow>) : renderTableRows(activeRetenciones)}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4">
          {isMounted && noRecibidoRetenciones.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="no-recibidas" className="border rounded-2xl px-4 bg-rose-500/[0.02] border-rose-500/10 hover:border-rose-500/20 transition-all">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-2">
                    <FileX className="h-5 w-5 text-rose-600" />
                    <span className="font-black text-sm text-rose-950 uppercase tracking-tight">No Recibidas ({noRecibidoRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="border rounded-xl bg-background/80 shadow-inner overflow-hidden">
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

          {isMounted && anulatedRetenciones.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="anuladas" className="border rounded-2xl px-4 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/20 transition-all">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-2">
                    <Archive className="h-5 w-5 text-emerald-600" />
                    <span className="font-black text-sm text-emerald-950 uppercase tracking-tight">Archivadas ({anulatedRetenciones.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="border rounded-xl bg-background/80 shadow-inner overflow-hidden">
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
        <AlertDialogContent className="rounded-3xl border-2">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black">¿Eliminar registro?</AlertDialogTitle>
                <AlertDialogDescription className="text-base">
                    La retención <span className="font-mono font-bold text-primary underline decoration-2">{retentionToDelete?.numeroRetencion}</span> será eliminada de forma irreversible.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
                <AlertDialogCancel onClick={() => setRetentionToDelete(null)} className="rounded-xl font-bold text-sm h-11 px-6">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold h-11 px-6 text-sm shadow-lg shadow-destructive/20 transition-all active:scale-95">
                    Eliminar Permanente
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </TooltipProvider>
  );
}
