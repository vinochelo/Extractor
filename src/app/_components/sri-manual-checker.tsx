"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { consultarFacturaSRI, SriResponse } from "@/lib/sri-service";
import { Loader2, Search, CheckCircle2, AlertCircle, Clock, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SriManualChecker() {
  const [clave, setClave] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SriResponse | null>(null);
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
    const status = estado.toUpperCase();
    if (status === "AUTORIZADO") return "bg-green-500/10 border-green-500/50 text-green-700";
    if (status === "POR PROCESAR" || status === "RECIBIDO") return "bg-yellow-500/10 border-yellow-500/50 text-yellow-700";
    if (status === "NO AUTORIZADO" || status === "FUERA DE RANGO" || status === "RECHAZADO") return "bg-destructive/10 border-destructive/50 text-destructive";
    return "bg-muted border-border text-muted-foreground";
  };

  const getStatusIcon = (estado: string) => {
    const status = estado.toUpperCase();
    if (status === "AUTORIZADO") return <CheckCircle2 className="h-5 w-5" />;
    if (status === "POR PROCESAR") return <Clock className="h-5 w-5" />;
    return <AlertCircle className="h-5 w-5" />;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Consulta Individual SRI
        </CardTitle>
        <CardDescription>
          Ingresa los 49 dígitos de la clave de acceso o número de autorización para verificar su estado actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input
              placeholder="0000000000000000000000000000000000000000000000000"
              value={clave}
              onChange={handleInputChange}
              className="font-mono"
              disabled={loading}
            />
            <div className="absolute right-3 top-2 text-xs text-muted-foreground">
              {clave.length}/49
            </div>
          </div>
          <Button onClick={handleConsultar} disabled={loading || clave.length !== 49}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Consultar
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className={cn("p-4 rounded-lg border flex flex-col gap-2 animate-in fade-in zoom-in duration-300", getStatusStyles(result.estado))}>
            <div className="flex items-center gap-2 font-bold">
              {getStatusIcon(result.estado)}
              <span>ESTADO SRI: {result.estado}</span>
            </div>
            {result.mensaje && (
              <div className="text-sm flex gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p><strong>Detalle:</strong> {result.mensaje}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
