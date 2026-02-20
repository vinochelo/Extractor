"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Clock, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { saveProviderEmails, getProviderEmails, getLastUpdatedDate } from "@/lib/provider-emails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function EmailImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    setLastUpdated(getLastUpdatedDate());
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast({
            variant: "destructive",
            title: "Archivo vacío",
            description: "No se encontraron datos en el archivo seleccionado.",
          });
          return;
        }

        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);
        
        const rucKey = keys.find(k => k.toUpperCase() === "RUC");
        const emailKey = keys.find(k => k.toUpperCase() === "CORREO" || k.toUpperCase() === "EMAIL");

        if (!rucKey || !emailKey) {
          toast({
            variant: "destructive",
            title: "Columnas no encontradas",
            description: "El archivo debe contener las columnas 'RUC' y 'CORREO' (o 'EMAIL').",
          });
          return;
        }

        const emailMap: Record<string, string> = { ...getProviderEmails() };
        
        jsonData.forEach((row: any) => {
          const ruc = String(row[rucKey] || "").trim();
          const rawCorreo = String(row[emailKey] || "").trim();

          if (ruc && rawCorreo) {
            const currentEmails = emailMap[ruc] 
              ? emailMap[ruc].split(',').map(e => e.trim().toLowerCase()) 
              : [];
            
            const incomingEmails = rawCorreo
              .split(/[;,]/)
              .map(e => e.trim().toLowerCase())
              .filter(e => e !== "");

            let wasChanged = false;
            incomingEmails.forEach(email => {
              if (!currentEmails.includes(email)) {
                currentEmails.push(email);
                wasChanged = true;
              }
            });

            if (wasChanged) {
              emailMap[ruc] = currentEmails.join(',');
            }
          }
        });
        
        saveProviderEmails(emailMap);
        const now = new Date().toISOString();
        setLastUpdated(now);
        
        toast({
          title: "Importación exitosa",
          description: `Se han procesado los datos. Total de proveedores con correo: ${Object.keys(emailMap).length}.`,
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error al procesar el archivo",
          description: "Asegúrate de que sea un archivo de Excel (.xlsx, .xls) o CSV válido.",
        });
      }
    };

    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error de lectura",
        description: "No se pudo leer el archivo correctamente.",
      });
    };

    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const formatUpdateDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "eeee d 'de' MMMM 'a las' HH:mm:ss", { locale: es });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={cn(
      "w-full max-w-2xl mx-auto mt-8 transition-all duration-500",
      lastUpdated ? "border-green-500/40 shadow-md shadow-green-500/5 bg-green-500/[0.01]" : "border-border"
    )}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Importar Correos de Proveedores
          {lastUpdated && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        </CardTitle>
        <CardDescription>
          Sube un archivo de <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV</strong> con las columnas 'RUC' y 'CORREO'.
        </CardDescription>
        {lastUpdated && (
          <div className="flex items-center gap-2 mt-2 p-3 bg-green-500/10 rounded-md border border-green-500/20 text-xs text-green-700 font-semibold animate-in fade-in zoom-in duration-300">
            <Clock className="h-3.5 w-3.5" />
            <span>Última actualización: {formatUpdateDate(lastUpdated)}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".xlsx, .xls, .csv"
        />
        <Button 
          onClick={handleImportClick}
          variant={lastUpdated ? "outline" : "default"}
          className={cn(
            "w-full sm:w-auto transition-all",
            lastUpdated && "border-green-500/50 text-green-700 hover:bg-green-500/10 hover:text-green-800"
          )}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {lastUpdated ? "Actualizar / Cambiar archivo de correos" : "Importar archivo de Excel / CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}
