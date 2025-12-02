import type { Timestamp } from "firebase/firestore";

export type RetentionStatus = "Solicitado" | "Pendiente Anular" | "Anulado";

export type RetentionData = {
  numeroRetencion: string;
  numeroAutorizacion: string;
  razonSocialProveedor: string;
  rucProveedor: string;
  numeroFactura: string;
  fechaEmision: string;
  valorRetencion: string;
};

export type RetentionRecord = RetentionData & {
  id: string;
  fileName: string;
  createdAt: Timestamp | Date;
  userId: string;
  estado: RetentionStatus;
};
