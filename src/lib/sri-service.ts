/**
 * Servicio para consultar el estado de un comprobante en el SRI a través de una API externa.
 */

export interface SriResponse {
  estado: string;
  mensaje?: string;
  fechaAutorizacion?: string;
  claveAcceso?: string;
  debug_sri_response?: {
    EstadoAutorizacionComprobante?: {
      tipoComprobante?: string;
      rucEmisor?: string;
      mensajes?: any;
      fechaAutorizacion?: string;
      estadoAutorizacion?: string;
      claveAcceso?: string;
    }
  }
}

export async function consultarFacturaSRI(claveAcceso: string): Promise<SriResponse> {
  try {
    const response = await fetch('https://api-sri-autorizaciones.vercel.app/api/consultar-estado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ claveAcceso }),
    });

    if (!response.ok) {
      throw new Error(`Error en la consulta: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("SRI API Error:", error);
    throw error;
  }
}
