
import type { Timestamp } from "firebase/firestore";

export type RetentionStatus = "Solicitado" | "Pendiente Anular" | "Anulado" | "No Recibido";

export type Sociedad = "Etafashion" | "RM" | "Desconocida";

export type RetentionData = {
  numeroRetencion: string;
  numeroAutorizacion: string;
  razonSocialProveedor: string;
  rucProveedor: string;
  emailProveedor: string;
  numeroFactura: string;
  fechaEmision: string;
  valorRetencion: string;
  sociedad: Sociedad;
};

export type RetentionRecord = RetentionData & {
  id: string;
  fileName: string;
  createdAt: Timestamp | Date;
  userId: string;
  estado: RetentionStatus;
  sriEstado?: string;
  sriMensaje?: string;
  lastSriCheck?: Timestamp | Date;
  emailAnularSent?: boolean;
  sriAcceptanceRequested?: boolean;
};
