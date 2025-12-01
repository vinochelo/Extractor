"use client";

import React, { useState, useCallback, ChangeEvent, DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadCloud, File, X, Loader2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface PdfUploaderProps {
  onFileChange: (file: File) => void;
  onFileRemove: () => void;
  file: File | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
}

export function PdfUploader({
  onFileChange,
  onFileRemove,
  file,
  loading,
  error,
  warning,
}: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type === "application/pdf") {
      onFileChange(selectedFile);
    } else if (selectedFile) {
        alert("Por favor, sube solo archivos PDF.");
    }
  };

  const handleDragEnter = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files && e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  }, [onFileChange]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files && e.target.files[0];
    handleFileSelect(selectedFile);
    // Reset input to allow re-uploading the same file
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="space-y-4">
        {!file && !loading && (
          <label
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted transition-colors",
              isDragging ? "border-primary" : "border-border"
            )}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
              <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-semibold text-primary">Haz clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-xs text-muted-foreground">SOLO ARCHIVOS PDF</p>
            </div>
            <input
              id="dropzone-file"
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleInputChange}
              disabled={loading}
            />
          </label>
        )}

        {(loading || file) && (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              {loading ? (
                 <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : (
                <File className="w-6 h-6 text-primary" />
              )}
              <span className="text-sm font-medium truncate">{loading ? 'Procesando archivo...' : file?.name}</span>
            </div>
            {!loading && file && (
                <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onFileRemove}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error de extracción</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {warning && (
            <Alert variant="warning">
                <Info className="h-4 w-4" />
                <AlertTitle>Retención Duplicada</AlertTitle>
                <AlertDescription>{warning}</AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
