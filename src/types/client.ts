
export interface Client {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  createdAt: Date;
}

export type DocumentType = "invoice" | "tax";
