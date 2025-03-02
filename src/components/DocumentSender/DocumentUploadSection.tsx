
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MailIcon, MessageSquare } from "lucide-react";
import DocumentUpload from "@/components/DocumentUpload";
import AutoUpload from "@/components/AutoUpload";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";
import { useSendDocument } from "@/hooks/useDocumentSender";

export function DocumentUploadSection() {
  const [activeTab, setActiveTab] = useState<string>("manual");
  const { selectedClient, documentType, files, isLoading } = useDocumentSender();
  const { handleUpload, handleSend } = useSendDocument();

  if (!selectedClient) {
    return (
      <div className="flex h-[400px] items-center justify-center text-gray-500">
        Por favor, selecione um cliente para enviar documentos
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="rounded-lg bg-secondary p-4">
        <p className="font-medium">Cliente Selecionado:</p>
        <p>{selectedClient.name}</p>
        <p className="text-sm text-gray-600">{selectedClient.email}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Upload Manual</TabsTrigger>
          <TabsTrigger value="auto">Upload Automático</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <DocumentUpload documentType={documentType} onUpload={handleUpload} />

          {files && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleSend("email")}
                  disabled={isLoading}
                >
                  <MailIcon className="mr-2 h-4 w-4" />
                  Enviar por Email
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleSend("whatsapp")}
                  disabled={isLoading}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar por WhatsApp
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="auto">
          <AutoUpload selectedClient={selectedClient} documentType={documentType} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
