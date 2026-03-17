'use server';

/**
 * @fileOverview Extracts data from a PDF of an Ecuadorian 'retención' document.
 * 
 * Implementa rotación de llaves API con Failover: si una llave falla (por cuota),
 * intenta automáticamente con la siguiente disponible para garantizar la extracción.
 */

import {ai, createAiInstance, getAvailableApiKeys} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractRetentionDataFromPDFInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document of an Ecuadorian 'retención', as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractRetentionDataFromPDFInput = z.infer<typeof ExtractRetentionDataFromPDFInputSchema>;

const ExtractRetentionDataFromPDFOutputSchema = z.object({
  numeroRetencion: z.string().describe('El "Numero de retención" del documento.'),
  numeroAutorizacion: z.string().describe('El "numero de autorización" del documento.'),
  razonSocialProveedor: z.string().describe('La "razon social del proveedor" del documento.'),
  rucProveedor: z.string().describe('El "ruc del proveedor" del documento.'),
  emailProveedor: z.string().describe('El "Email" del proveedor en el documento. Extraer si está presente.'),
  numeroFactura: z.string().describe('El "numero de factura" del documento.'),
  fechaEmision: z.string().describe('La "fechaEmision" del documento.'),
  valorRetencion: z.string().describe('El "valor total retenido" del documento.'),
});
export type ExtractRetentionDataFromPDFOutput = z.infer<typeof ExtractRetentionDataFromPDFOutputSchema>;

/**
 * Procesa la extracción intentando con todas las llaves API disponibles en caso de error de cuota.
 */
export async function extractRetentionDataFromPDF(
  input: ExtractRetentionDataFromPDFInput
): Promise<ExtractRetentionDataFromPDFOutput> {
  const apiKeys = getAvailableApiKeys();
  let lastError: any = null;

  // Si no hay llaves configuradas, intentamos con la instancia por defecto
  if (apiKeys.length === 0) {
    return executeExtraction(ai, input);
  }

  // Barajamos las llaves para distribuir la carga equitativamente
  const shuffledKeys = [...apiKeys].sort(() => Math.random() - 0.5);

  for (const key of shuffledKeys) {
    try {
      const instance = createAiInstance(key);
      return await executeExtraction(instance, input);
    } catch (err: any) {
      console.warn(`Error con llave API (intentando con la siguiente):`, err.message);
      lastError = err;
      // Si el error es de cuota o similar, continuamos con la siguiente llave
      continue; 
    }
  }

  throw lastError || new Error("Todas las llaves API configuradas han fallado.");
}

/**
 * Ejecuta el prompt de extracción para una instancia específica de Genkit.
 */
async function executeExtraction(instance: any, input: ExtractRetentionDataFromPDFInput): Promise<ExtractRetentionDataFromPDFOutput> {
  const dynamicPrompt = instance.definePrompt({
    name: 'extractRetentionDataFromPDFPrompt',
    input: {schema: ExtractRetentionDataFromPDFInputSchema},
    output: {schema: ExtractRetentionDataFromPDFOutputSchema},
    prompt: `You are an expert in extracting data from Ecuadorian 'retención' documents.

    Extract the following fields from the document provided as a PDF data URI:
    - numeroRetencion
    - numeroAutorizacion
    - razonSocialProveedor
    - rucProveedor
    - emailProveedor (if available)
    - numeroFactura
    - fechaEmision
    - valorRetencion

    Return the extracted data in JSON format. Ensure all numeric strings and dates are preserved as they appear.

    PDF Document: {{media url=pdfDataUri}}`,
  });

  const {output} = await dynamicPrompt(input);
  if (!output) throw new Error("No se pudo extraer información del PDF.");
  return output;
}

/**
 * Definición estática del flujo para compatibilidad con Genkit UI.
 */
export const extractRetentionDataFromPDFFlow = ai.defineFlow(
  {
    name: 'extractRetentionDataFromPDFFlow',
    inputSchema: ExtractRetentionDataFromPDFInputSchema,
    outputSchema: ExtractRetentionDataFromPDFOutputSchema,
  },
  async input => {
    return extractRetentionDataFromPDF(input);
  }
);
