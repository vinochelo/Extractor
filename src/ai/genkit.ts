import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Obtiene una instancia de Genkit configurada con una llave API rotada.
 * Esto permite superar el límite de uso gratuito de una sola cuenta.
 */
export function getRotatedAi() {
  const keys = [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_GENAI_API_KEY_2,
    process.env.GOOGLE_GENAI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean);

  // Seleccionamos una llave al azar de las disponibles
  const apiKey = keys.length > 0 
    ? keys[Math.floor(Math.random() * keys.length)] 
    : undefined;

  return genkit({
    plugins: [googleAI({ apiKey })],
    model: 'googleai/gemini-2.5-flash',
  });
}

/**
 * Instancia base de Genkit para definiciones globales.
 */
export const ai = getRotatedAi();
