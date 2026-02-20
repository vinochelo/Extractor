
"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { saveProviderEmails, getProviderEmails } from "@/lib/provider-emails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmailImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Tomar la primera hoja
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) {
          toast({
            variant: "destructive",
            title: "Archivo vacío",
            description: "No se encontraron datos en el archivo seleccionado.",
          });
          return;
        }

        // Buscar las columnas requeridas ignorando mayúsculas/minúsculas
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

        // 1. Obtener correos existentes
        const existingEmails = getProviderEmails();
        // 2. Crear una copia para fusionar
        const emailMap: Record<string, string> = { ...existingEmails };
        
        let newRowsCount = 0;
        let updatedRowsCount = 0;

        jsonData.forEach((row: any) => {
          const ruc = String(row[rucKey] || "").trim();
          const correo = String(row[emailKey] || "").trim();

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
          description: `Se han añadido ${newRowsCount} nuevos y actualizado ${updatedRowsCount} correos. Total: ${Object.keys(emailMap).length} correos guardados.`,
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

    // Reset para permitir subir el mismo archivo después si es necesario
    if (fileInputRef.current) {
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
          Sube un archivo de <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV</strong> con las columnas 'RUC' y 'CORREO' para autocompletar destinatarios. Los datos se fusionarán con tu lista actual.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".xlsx, .xls, .csv"
        />
        <Button onClick={handleImportClick}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Importar archivo de Excel / CSV
        </Button>
      </CardContent>
    </Card>
  );
}
