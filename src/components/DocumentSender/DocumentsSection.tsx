
import { Card } from "@/components/ui/card";
import { DocumentTypeSelector } from "./DocumentTypeSelector";
import { DocumentUploadSection } from "./DocumentUploadSection";

export function DocumentsSection() {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xl font-semibold">Enviar Documentos</h2>
      <DocumentTypeSelector />
      <DocumentUploadSection />
    </Card>
  );
}
