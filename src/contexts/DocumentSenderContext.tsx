
import { createContext, useContext, useState, ReactNode } from "react";
import { Client, DocumentType } from "@/types/client";

interface DocumentSenderContextType {
  clients: Client[];
  setClients: (clients: Client[]) => void;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  documentType: DocumentType;
  setDocumentType: (type: DocumentType) => void;
  files: FileList | null;
  setFiles: (files: FileList | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}

const DocumentSenderContext = createContext<DocumentSenderContextType | undefined>(undefined);

export function DocumentSenderProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [files, setFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <DocumentSenderContext.Provider
      value={{
        clients,
        setClients,
        selectedClient,
        setSelectedClient,
        documentType,
        setDocumentType,
        files,
        setFiles,
        isLoading,
        setIsLoading,
      }}
    >
      {children}
    </DocumentSenderContext.Provider>
  );
}

export function useDocumentSender() {
  const context = useContext(DocumentSenderContext);
  if (context === undefined) {
    throw new Error("useDocumentSender must be used within a DocumentSenderProvider");
  }
  return context;
}
