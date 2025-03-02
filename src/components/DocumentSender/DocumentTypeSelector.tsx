
import { Button } from "@/components/ui/button";
import { FileIcon } from "lucide-react";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";

export function DocumentTypeSelector() {
  const { documentType, setDocumentType } = useDocumentSender();

  return (
    <div className="space-y-2">
      <p className="font-medium">Tipo de Documento:</p>
      <div className="flex gap-2">
        <Button
          variant={documentType === "invoice" ? "default" : "outline"}
          onClick={() => setDocumentType("invoice")}
        >
          <FileIcon className="mr-2 h-4 w-4" />
          Notas Fiscais
        </Button>
        <Button
          variant={documentType === "tax" ? "default" : "outline"}
          onClick={() => setDocumentType("tax")}
        >
          <FileIcon className="mr-2 h-4 w-4" />
          Documentos Fiscais
        </Button>
      </div>
    </div>
  );
}
