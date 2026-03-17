'use server';

/**
 * @fileOverview Extracts data from a PDF of an Ecuadorian 'retención' document.
 * 
 * Implementa rotación de llaves API para maximizar los límites de extracción gratuitos.
 *
 * - extractRetentionDataFromPDF - A function that handles the data extraction process.
 * - ExtractRetentionDataFromPDFInput - The input type for the extractRetentionDataFromPDF function.
 * - ExtractRetentionDataFromPDFOutput - The return type for the extractRetentionDataFromPDF function.
 */

import {ai, getRotatedAi} from '@/ai/genkit';
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
 * Wrapper de la acción del servidor que utiliza rotación de llaves API.
 */
export async function extractRetentionDataFromPDF(
  input: ExtractRetentionDataFromPDFInput
): Promise<ExtractRetentionDataFromPDFOutput> {
  // Obtenemos una instancia fresca de AI con una llave rotada
  const rotatedAi = getRotatedAi();
  
  // Definimos y ejecutamos el prompt dinámicamente con la nueva llave
  const dynamicPrompt = rotatedAi.definePrompt({
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

    Return the extracted data in JSON format.

    PDF Document: {{media url=pdfDataUri}}`,
  });

  const {output} = await dynamicPrompt(input);
  return output!;
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
