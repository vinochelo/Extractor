'use client';

import { useEffect, useState } from 'react';
import { PdfUploader } from './pdf-uploader';
import { ExtractionResultCard } from './extraction-result-card';
import { RetentionHistoryTable } from './retention-history-table';
import { extractData } from '@/app/actions';
import {
  useUser,
  useFirestore,
  addDocumentNonBlocking,
  useAuth,
  initiateAnonymousSignIn,
} from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { RetentionRecord } from '@/lib/types';
import { EmailImporter } from './email-importer';
import { SriManualChecker } from './sri-manual-checker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { consultarFacturaSRI } from '@/lib/sri-service';

export function MainPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<RetentionRecord | null>(
    null
  );
  // Inicializamos con un valor estable para evitar errores de hidratación
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    // Actualizamos la clave solo en el cliente tras el montaje
    setHistoryKey(Date.now());
  }, []);

  useEffect(() => {
    if (!user && !isUserLoading && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const handleFileChange = (selectedFile: File) => {
    setExtractedData(null);
    setError(null);
    setDuplicateWarning(null);
    setFile(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (fileToProcess: File) => {
    if (!user || !firestore) return;

    setLoading(true);
    setError(null);
    setDuplicateWarning(null);
    setExtractedData(null);

    try {
      const fileAsDataUrl = await fileToDataUrl(fileToProcess);
      const result = await extractData({
        fileAsDataUrl,
      });

      if (result.success) {
        // Consultar SRI inmediatamente al cargar
        let sriResult = null;
        try {
          sriResult = await consultarFacturaSRI(result.data.numeroAutorizacion);
        } catch (sriErr) {
          console.warn("No se pudo consultar el SRI durante la carga inicial.");
        }

        const retentionRecordData = {
          ...result.data,
          fileName: fileToProcess.name,
          createdAt: new Date(),
          userId: user.uid,
          estado: 'Solicitado' as const,
          sriEstado: sriResult?.estado || null,
          sriMensaje: sriResult?.mensaje || null,
          lastSriCheck: new Date(),
        };

        const retencionesCollection = collection(
          firestore,
          'users',
          user.uid,
          'retenciones'
        );
        const q = query(
          retencionesCollection,
          where('numeroRetencion', '==', result.data.numeroRetencion)
        );
        const querySnapshot = await getDocs(q);

        setExtractedData({ ...retentionRecordData, id: 'temp-preview' } as any);
        setFile(null);

        if (!querySnapshot.empty) {
          setDuplicateWarning(
            `La retención Nro. ${result.data.numeroRetencion} ya existe en tu historial. No se guardará de nuevo.`
          );
        } else {
          const docRef = await addDocumentNonBlocking(
            retencionesCollection,
            retentionRecordData
          );
          setHistoryKey(Date.now());
          if (docRef) {
            setExtractedData({ ...retentionRecordData, id: docRef.id } as any);
          }
        }
      } else {
        setError(result.error);
      }
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (file && user && firestore) {
      handleSubmit(file);
    }
  }, [file, user, firestore]);

  return (
    <main className="container mx-auto px-4 py-12 md:py-20">
      <div className="text-center mb-16">
        <h1 className="font-headline text-5xl md:text-6xl font-extrabold tracking-tight text-primary mb-4">
          Status Retenciones
        </h1>
        <div className="h-1 w-24 bg-primary mx-auto mb-6 rounded-full opacity-20" />
        <p className="max-w-2xl mx-auto text-xl text-muted-foreground font-medium">
          Gestión inteligente de retenciones del SRI con el poder de la IA.
        </p>
      </div>

      <Tabs defaultValue="historial" className="space-y-12">
        <TabsList className="grid w-full max-w-lg mx-auto grid-cols-2 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="historial" className="rounded-lg py-2.5 data-[state=active]:shadow-md">Historial y Carga</TabsTrigger>
          <TabsTrigger value="herramientas" className="rounded-lg py-2.5 data-[state=active]:shadow-md">Consultas Autorizaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="historial" className="space-y-16">
          <RetentionHistoryTable key={historyKey} />

          <div className="bg-card/30 p-8 rounded-3xl border border-dashed border-primary/20">
            <PdfUploader
              file={file}
              onFileChange={handleFileChange}
              onFileRemove={handleRemoveFile}
              loading={loading || isUserLoading}
              error={error}
              warning={duplicateWarning}
            />
          </div>

          {extractedData && <ExtractionResultCard data={extractedData} />}
          
          <EmailImporter />
        </TabsContent>

        <TabsContent value="herramientas" className="space-y-12">
          <SriManualChecker />
        </TabsContent>
      </Tabs>
    </main>
  );
}
