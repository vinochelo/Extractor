import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Obtiene la lista de llaves API disponibles configuradas en el entorno.
 * Permite rotar entre múltiples cuentas para maximizar los límites gratuitos.
 */
export function getAvailableApiKeys(): string[] {
  return [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY_2,
    process.env.GOOGLE_GENAI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean) as string[];
}

/**
 * Crea una instancia de Genkit configurada con una llave específica.
 * @param apiKey - La llave de API de Google GenAI a utilizar.
 */
export function createAiInstance(apiKey?: string) {
  return genkit({
    plugins: [googleAI({ apiKey })],
    model: 'googleai/gemini-2.5-flash',
  });
}

/**
 * Instancia base de Genkit (usa la primera llave disponible por defecto).
 */
export const ai = createAiInstance(getAvailableApiKeys()[0]);
