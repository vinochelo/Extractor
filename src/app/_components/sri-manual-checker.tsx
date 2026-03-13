"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { consultarFacturaSRI } from "@/lib/sri-service";
import { Loader2, Search, CheckCircle2, AlertCircle, Clock, ShieldCheck, Building2, FileText, CalendarDays, MessageSquare, Fingerprint, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SriManualChecker() {
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 49);
    setClave(value);
    if (error) setError(null);
  };

  const handleConsultar = async () => {
    if (clave.length !== 49) {
      setError("La clave de acceso debe tener exactamente 49 dígitos numéricos.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await consultarFacturaSRI(clave);
      setResult(data);
    } catch (err: any) {
      setError("No se pudo conectar con el servicio del SRI. Inténtalo de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyles = (estado: string) => {
    const status = (estado || "").toUpperCase();
    if (status === "AUTORIZADO") return "bg-green-500/10 border-green-500/50 text-green-700";
    if (status === "POR PROCESAR" || status === "RECIBIDO") return "bg-yellow-500/10 border-yellow-500/50 text-yellow-700";
    if (status === "FUERA DE RANGO") return "bg-orange-500/10 border-orange-500/50 text-orange-700";
    if (status === "NO AUTORIZADO" || status === "RECHAZADO") return "bg-destructive/10 border-destructive/50 text-destructive";
    return "bg-muted border-border text-muted-foreground";
  };

  const getStatusIcon = (estado: string) => {
    const status = (estado || "").toUpperCase();
    if (status === "AUTORIZADO") return <CheckCircle2 className="h-6 w-6" />;
    if (status === "POR PROCESAR") return <Clock className="h-6 w-6" />;
    if (status === "FUERA DE RANGO") return <CalendarOff className="h-6 w-6" />;
    return <AlertCircle className="h-6 w-6" />;
  };

  const formatSriDate = (dateString?: string) => {
    if (!dateString) return "No disponible";
    if (!mounted) return "...";
    try {
      return format(new Date(dateString), "d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es });
    } catch {
      return dateString;
    }
  };

  const isFueraDeRango = (result?.estado || "").toUpperCase() === "FUERA DE RANGO";

  const infoSRI = result?.debug_sri_response?.EstadoAutorizacionComprobante || {};
  
  const tipoComprobante = infoSRI.tipoComprobante || result?.tipoComprobante || "No disponible";
  const rucEmisor = infoSRI.rucEmisor || result?.rucEmisor || "No disponible";
  const fechaAutorizacion = result?.fechaAutorizacion || infoSRI.fechaAutorizacion;
  const claveAccesoVerificada = result?.claveAcceso || infoSRI.claveAcceso || clave;
  const mensajes = infoSRI.mensajes || result?.mensaje;

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 border-2 shadow-xl rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
      <CardHeader className="bg-muted/30 pb-8 border-b">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
                <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Consultas Autorizaciones</CardTitle>
        </div>
        <CardDescription className="text-base font-medium">
          Verifica la validez y el estado actual de cualquier comprobante electrónico ingresando su número de autorización.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-8 px-8">
        <div className="space-y-4">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
            Clave de Acceso / Número de Autorización (49 dígitos)
          </label>
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <Input
                placeholder="Ingresa la clave de acceso aquí..."
                value={clave}
                onChange={handleInputChange}
                className={cn(
                  "h-16 text-xl font-mono tracking-[0.15em] px-5 border-2 transition-all duration-300 rounded-2xl bg-background",
                  clave.length === 49 ? "border-primary/50 bg-primary/[0.02] shadow-sm" : "hover:border-primary/30"
                )}
                disabled={loading}
              />
              <div className={cn(
                "absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1.5 rounded-lg transition-all duration-300",
                clave.length === 49 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {clave.length}/49
              </div>
            </div>
            <Button 
                onClick={handleConsultar} 
                disabled={loading || clave.length !== 49}
                className="h-14 text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/10 transition-all active:scale-[0.98]"
            >
              {loading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Search className="mr-2 h-6 w-6" />}
              Consultar en el SRI
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4 rounded-xl border-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Error de consulta</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className={cn(
              "p-8 rounded-2xl border-2 flex flex-col gap-4 shadow-sm", 
              getStatusStyles(result.estado)
            )}>
              <div className="flex items-center gap-4 text-3xl font-black uppercase tracking-tighter">
                {getStatusIcon(result.estado)}
                <span>{result.estado || "No disponible"}</span>
              </div>
              
              {isFueraDeRango ? (
                <div className="p-5 bg-orange-500/20 rounded-xl border border-orange-500/30 text-orange-950 font-bold flex items-center gap-4 animate-in fade-in slide-in-from-left-4">
                  <AlertCircle className="h-6 w-6 shrink-0" />
                  <p className="text-lg">Solo se puede consultar comprobantes de hasta 30 días atrás.</p>
                </div>
              ) : (
                mensajes && (
                  <div className="text-sm font-medium flex gap-3 p-5 bg-background/60 rounded-xl border border-current/10 backdrop-blur-sm">
                    <MessageSquare className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold opacity-80 block mb-1 uppercase text-[10px] tracking-widest">Información Detallada:</span>
                      <p className="leading-relaxed">{typeof mensajes === 'string' ? mensajes : "Detalles técnicos disponibles abajo."}</p>
                    </div>
                  </div>
                )
              )}
            </div>

            {!isFueraDeRango && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-muted/20 rounded-2xl border border-border/50 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Tipo de Comprobante</p>
                    <p className="font-bold text-foreground leading-tight">{tipoComprobante}</p>
                  </div>
                </div>
                
                <div className="p-5 bg-muted/20 rounded-2xl border border-border/50 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">RUC Emisor</p>
                    <p className="font-bold font-mono text-foreground">{rucEmisor}</p>
                  </div>
                </div>

                <div className="p-5 bg-muted/20 rounded-2xl border border-border/50 flex items-start gap-4 md:col-span-2 hover:bg-muted/30 transition-colors">
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <CalendarDays className="h-5 w-5 text-primary shrink-0" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Fecha de Autorización</p>
                    <p className="font-bold text-foreground">{formatSriDate(fechaAutorizacion)}</p>
                  </div>
                </div>

                <div className="p-5 bg-muted/20 rounded-2xl border border-border/50 flex items-start gap-4 md:col-span-2 hover:bg-muted/30 transition-colors">
                  <div className="p-2 bg-primary/5 rounded-lg">
                    <Fingerprint className="h-5 w-5 text-primary shrink-0" />
                  </div>
                  <div className="overflow-hidden w-full">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Clave de Acceso Verificada</p>
                    <p className="font-mono text-[11px] break-all text-primary font-medium tracking-wider">{claveAccesoVerificada}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
