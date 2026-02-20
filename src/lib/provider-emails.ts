"use client";

const LOCAL_STORAGE_KEY = "provider-emails";

/**
 * Guarda el mapa de RUCs y correos en el localStorage.
 * @param emails - Un objeto donde la clave es el RUC y el valor es el email.
 */
export const saveProviderEmails = (emails: Record<string, string>): void => {
  try {
    const jsonValue = JSON.stringify(emails);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, jsonValue);
  } catch (error) {
    console.error("Error saving provider emails to localStorage:", error);
  }
};

/**
 * Obtiene el mapa de RUCs y correos desde el localStorage.
 * @returns El objeto con RUCs y emails, o un objeto vacío si no hay datos.
 */
export const getProviderEmails = (): Record<string, string> => {
  try {
    const jsonValue = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return jsonValue ? JSON.parse(jsonValue) : {};
  } catch (error) {
    console.error("Error getting provider emails from localStorage:", error);
    return {};
  }
};

/**
 * Busca un correo electrónico por el RUC del proveedor.
 * @param ruc - El RUC del proveedor a buscar.
 * @returns El correo electrónico si se encuentra, de lo contrario, una cadena vacía.
 */
export const getEmailByRuc = (ruc: string): string => {
    if (typeof window === "undefined") return "";
    const emails = getProviderEmails();
    return emails[ruc] || "";
};

/**
 * Combina un email opcional (ej. de un PDF) con los emails guardados para un RUC.
 * @param ruc - El RUC del proveedor.
 * @param pdfEmail - Email extraído del PDF (opcional).
 * @returns Una cadena con todos los emails únicos separados por comas.
 */
export const getAllEmailsForProvider = (ruc: string, pdfEmail?: string): string => {
    const allEmails = new Set<string>();
    
    // 1. Agregar email del PDF si existe
    if (pdfEmail && pdfEmail.trim()) {
        pdfEmail.split(/[;,]/).forEach(e => {
            if (e.trim()) allEmails.add(e.toLowerCase().trim());
        });
    }
    
    // 2. Agregar emails del almacenamiento (importados de Excel)
    const emailsFromStorage = getEmailByRuc(ruc);
    if (emailsFromStorage) {
        emailsFromStorage.split(/[;,]/).forEach(e => {
            if (e.trim()) allEmails.add(e.toLowerCase().trim());
        });
    }
    
    return Array.from(allEmails).join(',');
};
