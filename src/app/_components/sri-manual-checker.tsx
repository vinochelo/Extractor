"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { consultarFacturaSRI, SriResponse } from "@/lib/sri-service";
import { Loader2, Search, CheckCircle2, AlertCircle, Clock, ShieldCheck, Building2, FileText, CalendarDays, MessageSquare, Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SriManualChecker() {
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setResult(null);

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
    if (status === "NO AUTORIZADO" || status === "FUERA DE RANGO" || status === "RECHAZADO") return "bg-destructive/10 border-destructive/50 text-destructive";
    return "bg-muted border-border text-muted-foreground";
  };

  const getStatusIcon = (estado: string) => {
    const status = (estado || "").toUpperCase();
    if (status === "AUTORIZADO") return <CheckCircle2 className="h-6 w-6" />;
    if (status === "POR PROCESAR") return <Clock className="h-6 w-6" />;
    return <AlertCircle className="h-6 w-6" />;
  };

  const formatSriDate = (dateString?: string) => {
    if (!dateString) return "No disponible";
    try {
      return format(new Date(dateString), "d 'de' MMMM 'de' yyyy, HH:mm:ss", { locale: es });
    } catch {
      return dateString;
    }
  };

  // Función de ayuda para buscar valores en objetos anidados de forma flexible
  const findValue = (obj: any, keys: string[]) => {
    if (!obj) return null;
    
    // Intentar en el nivel superior primero
    for (const key of keys) {
      if (obj[key]) return obj[key];
    }

    // Intentar dentro de debug_sri_response
    const debug = obj.debug_sri_response;
    if (debug) {
      // Caso 1: Estructura directa o anidada en EstadoAutorizacionComprobante
      const inner = debug.EstadoAutorizacionComprobante || debug.estadoAutorizacionComprobante;
      if (inner) {
        for (const key of keys) {
          if (inner[key]) return inner[key];
        }
      }

      // Caso 2: Estructura de array (autorizaciones.autorizacion)
      const authList = debug.autorizaciones?.autorizacion;
      if (Array.isArray(authList) && authList.length > 0) {
        for (const key of keys) {
          if (authList[0][key]) return authList[0][key];
        }
      } else if (authList) {
        for (const key of keys) {
          if (authList[key]) return authList[key];
        }
      }
    }
    
    return null;
  };

  const tipoComprobante = findValue(result, ["tipoComprobante", "tipo_comprobante"]) || "No especificado";
  
  // Extraer RUC: Intentar API, si no, extraer de la Clave de Acceso (dígitos 11 al 23)
  const rucEmisor = findValue(result, ["rucEmisor", "ruc_emisor"]) || (clave.length === 49 ? clave.substring(10, 23) : "No especificado");
  
  const fechaAutorizacion = findValue(result, ["fechaAutorizacion", "fecha_autorizacion", "fechaAutorizacionComprobante"]);
  
  const claveAccesoVerificada = findValue(result, ["claveAcceso", "clave_acceso"]) || result?.claveAcceso || clave;

  const mensajes = findValue(result, ["mensajes", "mensaje", "informacionAdicional"]);

  return (
    <Card className="w-full max-w-3xl mx-auto mt-8 border-2 shadow-xl rounded-2xl overflow-hidden">
      <CardHeader className="bg-muted/30 pb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
                <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Consulta Autorizaciones</CardTitle>
        </div>
        <CardDescription className="text-base">
          Verifica la validez y el estado actual de cualquier comprobante electrónico ingresando su número de autorización.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-8 px-8">
        <div className="space-y-4">
          <label className="text-sm font-bold text-muted-foreground uppercase tracking-wider ml-1">
            Clave de Acceso / Número de Autorización
          </label>
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <Input
                placeholder="Ingresa los 49 dígitos numéricos"
                value={clave}
                onChange={handleInputChange}
                className={cn(
                  "h-16 text-lg font-mono tracking-[0.2em] px-4 border-2 transition-all duration-300 rounded-xl",
                  clave.length === 49 ? "border-primary bg-primary/5 shadow-inner" : "hover:border-primary/50"
                )}
                disabled={loading}
              />
              <div className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold px-2 py-1 rounded-md transition-all duration-300",
                clave.length === 49 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {clave.length}/49
              </div>
            </div>
            <Button 
                onClick={handleConsultar} 
                disabled={loading || clave.length !== 49}
                className="h-14 text-lg font-bold rounded-xl shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
            >
              {loading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Search className="mr-2 h-6 w-6" />}
              Consultar ahora en el SRI
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-bold">Error de consulta</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Estado Principal */}
            <div className={cn(
              "p-6 rounded-2xl border-2 flex flex-col gap-3 shadow-sm", 
              getStatusStyles(result.estado)
            )}>
              <div className="flex items-center gap-3 text-2xl font-extrabold uppercase tracking-tight">
                {getStatusIcon(result.estado)}
                <span>Estado: {result.estado || "No disponible"}</span>
              </div>
              
              {(result.mensaje || mensajes) && (
                <div className="text-sm font-medium flex gap-3 p-4 bg-background/50 rounded-xl border border-current/20">
                  <MessageSquare className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold opacity-70 block mb-1">Información Detallada:</span>
                    <p>{result.mensaje || "Revisa los detalles técnicos del SRI a continuación."}</p>
                    {mensajes && (
                       <div className="mt-2 text-xs font-mono opacity-80 bg-black/5 p-2 rounded">
                          {typeof mensajes === 'string' 
                            ? mensajes 
                            : JSON.stringify(mensajes, null, 2)}
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Detalles Técnicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo de Comprobante</p>
                  <p className="font-semibold">{tipoComprobante}</p>
                </div>
              </div>
              
              <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-start gap-3">
                <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">RUC Emisor</p>
                  <p className="font-semibold font-mono">{rucEmisor}</p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-start gap-3 md:col-span-2">
                <CalendarDays className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fecha de Autorización</p>
                  <p className="font-semibold">{formatSriDate(fechaAutorizacion)}</p>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-start gap-3 md:col-span-2">
                <Fingerprint className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="overflow-hidden w-full">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Clave de Acceso Verificada</p>
                  <p className="font-mono text-[11px] break-all text-primary/80">{claveAccesoVerificada}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
