
import { useState, useEffect } from "react";
import { Client, DocumentType } from "@/types/client";
import ClientForm from "@/components/ClientForm";
import ClientList from "@/components/ClientList";
import DocumentUpload from "@/components/DocumentUpload";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MailIcon, FileIcon, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("invoice");
  const [files, setFiles] = useState<FileList | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClients(data.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        whatsapp: client.whatsapp,
        createdAt: new Date(client.created_at),
      })));
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
        variant: "destructive",
      });
    }
  };

  const handleClientSave = (client: Client) => {
    setClients([client, ...clients]);
  };

  const handleUpload = (files: FileList) => {
    setFiles(files);
    toast({
      title: "Arquivos Selecionados",
      description: `${files.length} arquivos prontos para envio`,
    });
  };

  const handleSend = async (method: "email" | "whatsapp") => {
    if (!selectedClient || !files) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um cliente e arquivos primeiro",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Upload files and send them
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', selectedClient.id);
        formData.append('documentType', documentType);

        // Upload file
        const uploadResponse = await supabase.functions.invoke('upload-document', {
          body: formData,
        });

        if (!uploadResponse.data) {
          throw new Error('Failed to upload document');
        }

        // Send via selected method
        if (method === "email") {
          const sendResponse = await supabase.functions.invoke('send-document', {
            body: {
              clientEmail: selectedClient.email,
              clientName: selectedClient.name,
              documentType,
              filePath: uploadResponse.data.filePath,
            },
          });

          if (!sendResponse.data) {
            throw new Error('Failed to send email');
          }
        } else if (method === "whatsapp") {
          // WhatsApp sending will be implemented in the next step
          toast({
            title: "Em breve",
            description: "Envio por WhatsApp será implementado em breve",
          });
        }
      }

      toast({
        title: "Sucesso",
        description: `${files.length} documento(s) ${method === 'email' ? 'enviado(s) por email' : 'preparado(s) para WhatsApp'}`,
      });

      // Reset state after successful upload and send
      setFiles(null);
      setSelectedClient(null);
    } catch (error) {
      console.error('Error handling documents:', error);
      toast({
        title: "Erro",
        description: `Erro ao ${method === 'email' ? 'enviar email' : 'enviar WhatsApp'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <h1 className="mb-8 text-center text-4xl font-bold">Enviador de Documentos</h1>
      
      <div className="grid gap-8 md:grid-cols-2">
        <Card className="p-6">
          <Tabs defaultValue="register" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register">Cadastrar Cliente</TabsTrigger>
              <TabsTrigger value="select">Selecionar Cliente</TabsTrigger>
            </TabsList>
            <TabsContent value="register">
              <ClientForm onSave={handleClientSave} />
            </TabsContent>
            <TabsContent value="select">
              <ClientList clients={clients} onSelect={setSelectedClient} />
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-xl font-semibold">Enviar Documentos</h2>
          
          {selectedClient ? (
            <div className="animate-fadeIn space-y-4">
              <div className="rounded-lg bg-secondary p-4">
                <p className="font-medium">Cliente Selecionado:</p>
                <p>{selectedClient.name}</p>
                <p className="text-sm text-gray-600">{selectedClient.email}</p>
              </div>

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
            </div>
          ) : (
            <div className="flex h-[400px] items-center justify-center text-gray-500">
              Por favor, selecione um cliente para enviar documentos
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
