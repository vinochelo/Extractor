"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Import } from "lucide-react";
import Papa from "papaparse";
import { saveProviderEmails, getProviderEmails } from "@/lib/provider-emails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "text/csv") {
        toast({
            variant: "destructive",
            title: "Archivo no válido",
            description: "Por favor, selecciona un archivo con formato .csv",
        });
        return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const requiredHeaders = ["RUC", "CORREO"];
        const headers = results.meta.fields || [];
        const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));

        if (!hasRequiredHeaders) {
            toast({
                variant: "destructive",
                title: "Cabeceras incorrectas",
                description: `El archivo CSV debe contener las columnas: ${requiredHeaders.join(", ")}.`,
            });
            return;
        }

        // 1. Obtener correos existentes
        const existingEmails = getProviderEmails();
        // 2. Crear una copia para fusionar
        const emailMap: Record<string, string> = { ...existingEmails };
        
        let newRowsCount = 0;
        let updatedRowsCount = 0;

        results.data.forEach((row: any) => {
            const ruc = row.RUC?.trim();
            const correo = row.CORREO?.trim();

            if (ruc && correo) {
                if (existingEmails[ruc]) {
                    if (existingEmails[ruc] !== correo) {
                        updatedRowsCount++;
                    }
                } else {
                    newRowsCount++;
                }
                emailMap[ruc] = correo;
            }
        });
        
        // 3. Guardar la lista fusionada
        saveProviderEmails(emailMap);
        
        toast({
            title: "Importación exitosa",
            description: `Se han añadido ${newRowsCount} nuevos y actualizado ${updatedRowsCount} correos de proveedores. Total: ${Object.keys(emailMap).length} correos guardados.`,
        });
      },
      error: (error: any) => {
        toast({
            variant: "destructive",
            title: "Error al leer el archivo",
            description: error.message,
        });
      }
    });

    // Reset file input to allow re-uploading the same file
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
            <CardTitle>Importar Correos de Proveedores</CardTitle>
            <CardDescription>
                Sube un archivo .csv con las columnas 'RUC' y 'CORREO' para autocompletar el destinatario en las solicitudes al SRI. Los datos se fusionarán con los que ya tengas guardados localmente.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv"
            />
            <Button onClick={handleImportClick}>
                <Import className="mr-2 h-4 w-4" />
                Importar archivo .csv
            </Button>
        </CardContent>
    </Card>
  );
}
