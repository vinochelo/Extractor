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
  const [historyKey, setHistoryKey] = useState(Date.now());

  useEffect(() => {
    // Automatically sign in the user anonymously if not logged in and not loading.
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
        // Prepare the record to show/save
        const retentionRecordData = {
          ...result.data,
          fileName: fileToProcess.name,
          createdAt: new Date(), // Use JS Date object, Firestore will convert it.
          userId: user.uid,
          estado: 'Solicitado' as const, // Set default status
        };

        // --- Check for duplicates ---
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

        // Always show the extracted data card
        setExtractedData({ ...retentionRecordData, id: 'temp-preview' });
        setFile(null); // Clear the file input

        if (!querySnapshot.empty) {
          // --- It's a duplicate ---
          setDuplicateWarning(
            `La retención Nro. ${result.data.numeroRetencion} ya existe en tu historial. No se guardará de nuevo.`
          );
        } else {
          // --- It's not a duplicate, save it ---
          const docRef = await addDocumentNonBlocking(
            retencionesCollection,
            retentionRecordData
          );
          // Refresh the history table
          setHistoryKey(Date.now());
          // We can update the temporary extracted data with the real ID, though not strictly necessary
          if (docRef) {
            setExtractedData({ ...retentionRecordData, id: docRef.id });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, user, firestore]);

  return (
    <main className="container mx-auto px-4 py-8 md:py-16">
      <div className="text-center mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tight">
          Retenciones Anuladas
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
          Extrae datos de tus documentos de retención PDF de forma rápida y
          segura con el poder de la IA.
        </p>
      </div>

      <div className="mb-12">
        <RetentionHistoryTable key={historyKey} />
      </div>

      <div className="space-y-12">
        <PdfUploader
          file={file}
          onFileChange={handleFileChange}
          onFileRemove={handleRemoveFile}
          loading={loading || isUserLoading}
          error={error}
          warning={duplicateWarning}
        />

        {extractedData && <ExtractionResultCard data={extractedData} />}
        
        <EmailImporter />
      </div>
    </main>
  );
}
