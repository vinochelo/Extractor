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
import { FileText, LayoutDashboard } from 'lucide-react';

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
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-background to-background">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-7xl">
        <header className="text-center mb-10 relative animate-in fade-in slide-in-from-top-10 duration-1000">
          <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tighter text-primary mb-3 filter drop-shadow-sm">
            Status Retenciones
          </h1>
          <p className="max-w-xl mx-auto text-lg text-muted-foreground/80 font-semibold tracking-tight leading-tight">
            Gestión inteligente de comprobantes electrónicos del SRI.
          </p>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/[0.02] blur-[100px] rounded-full -z-10" />
        </header>

        <Tabs defaultValue="historial" className="space-y-10">
          <div className="flex justify-center mb-8">
            <TabsList className="grid w-full max-w-sm grid-cols-2 h-12 p-1 bg-muted/40 backdrop-blur-md rounded-xl border border-border/50 shadow-lg">
              <TabsTrigger value="historial" className="rounded-lg py-2 font-bold text-xs tracking-tight transition-all data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary flex items-center gap-2">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Historial y Carga
              </TabsTrigger>
              <TabsTrigger value="herramientas" className="rounded-lg py-2 font-bold text-xs tracking-tight transition-all data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                Consultas Autorizaciones
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="historial" className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
            <RetentionHistoryTable key={historyKey} />

            <section className="space-y-6">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black tracking-tight">Nueva Extracción</h2>
                <p className="text-sm text-muted-foreground font-medium">Extrae datos automáticamente de tus archivos PDF.</p>
              </div>
              <div className="bg-card/40 backdrop-blur-md p-8 rounded-[2rem] border-2 border-dashed border-primary/10 shadow-xl transition-all hover:border-primary/30 group">
                <PdfUploader
                  file={file}
                  onFileChange={handleFileChange}
                  onFileRemove={handleRemoveFile}
                  loading={loading || isUserLoading}
                  error={error}
                  warning={duplicateWarning}
                />
              </div>
            </section>

            {extractedData && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
                <ExtractionResultCard data={extractedData} />
              </div>
            )}
            
            <section className="pt-6 border-t border-border/40">
               <EmailImporter />
            </section>
          </TabsContent>

          <TabsContent value="herramientas" className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
            <SriManualChecker />
          </TabsContent>
        </Tabs>
        
        <footer className="mt-20 pt-8 border-t border-border/30 text-center">
            <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.3em]">Status Retenciones &copy; {new Date().getFullYear()} • Gestión SRI Eficiente</p>
        </footer>
      </div>
    </main>
  );
}
