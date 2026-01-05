"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Mail, Check, Send } from "lucide-react";
import { RetentionRecord } from "@/lib/types";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { getEmailByRuc } from "@/lib/provider-emails";


interface ExtractionResultCardProps {
  data: RetentionRecord;
}

// Helper to format keys for display
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
    'valorRetencion',
];

export function ExtractionResultCard({ data }: ExtractionResultCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Filter out unwanted properties and sort them
  const displayableData = desiredOrder
    .map(key => [key, data[key]])
    .filter(([key, value]) => value !== undefined && value !== null && value !== '') as [string, any][];

  const formattedTextForEmail = displayableData
    .map(([key, value]) => `${formatDisplayKey(key)}: ${value}`)
    .join('\n');
    
  const fullFormattedTextForCopy = `
Resumen de Retención:
--------------------------------
${formattedTextForEmail}
--------------------------------
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullFormattedTextForCopy).then(() => {
      setCopied(true);
      toast({
        title: "Copiado al portapapeles",
        description: "Los datos de la retención han sido copiados.",
      });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareForVoiding = () => {
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

  const handleRequestSriAcceptance = () => {
    const providerEmail = data.emailProveedor || getEmailByRuc(data.rucProveedor);
    const subject = `Anulación retención ${data.numeroRetencion}`;
    const emailBody = `Por medio de la presente, solicitamos su apoyo revisando en el portal del SRI la anulación correspondiente a la siguiente retención:

Detalles de la retención:
--------------------------------
${formattedTextForEmail}
--------------------------------

Agradecemos su pronta gestión.
`;
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${providerEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8 animate-in fade-in-50 slide-in-from-bottom-5 duration-500">
      <CardHeader>
        <CardTitle>Datos Extraídos</CardTitle>
        <CardDescription>
          Se ha extraído la siguiente información del documento.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {displayableData.map(([key, value]) => (
            <div key={key} className={cn(
              "p-3 bg-muted/50 rounded-lg",
              (key === 'numeroRetencion' || key === 'emailProveedor') && 'sm:col-span-2'
            )}>
              <p className="font-semibold text-muted-foreground">{formatDisplayKey(key)}</p>
              <p className={cn(
                "font-mono text-foreground break-words",
                key === 'numeroRetencion' && 'text-xl font-bold tracking-wider'
              )}>{value}</p>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={handleShareForVoiding}>
          <Mail className="mr-2" />
          Email para Anular
        </Button>
        <Button variant="outline" onClick={handleRequestSriAcceptance}>
          <Send className="mr-2" />
          Solicitar Aceptación SRI
        </Button>
        <Button onClick={handleCopy}>
          {copied ? <Check className="mr-2" /> : <Copy className="mr-2" />}
          {copied ? "Copiado" : "Copiar Todo"}
        </Button>
      </CardFooter>
    </Card>
  );
}
