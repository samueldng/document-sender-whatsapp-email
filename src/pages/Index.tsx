
import { DocumentSenderProvider } from "@/contexts/DocumentSenderContext";
import { ClientSection } from "@/components/DocumentSender/ClientSection";
import { DocumentsSection } from "@/components/DocumentSender/DocumentsSection";

export default function Index() {
  return (
    <DocumentSenderProvider>
      <div className="container mx-auto max-w-5xl py-8">
        <h1 className="mb-8 text-center text-4xl font-bold">Enviador de Documentos</h1>
        
        <div className="grid gap-8 md:grid-cols-2">
          <ClientSection />
          <DocumentsSection />
        </div>
      </div>
    </DocumentSenderProvider>
  );
}
