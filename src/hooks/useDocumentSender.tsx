
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";

export function useSendDocument() {
  const { toast } = useToast();
  const { selectedClient, documentType, files, setFiles, setIsLoading, setSelectedClient } = useDocumentSender();

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
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();

      if (bucketsError) {
        console.error("Erro ao verificar buckets:", bucketsError);
        throw new Error('Falha ao verificar buckets de armazenamento');
      }

      const documentsBucketExists = buckets?.some(bucket => bucket.name === 'documents');

      if (!documentsBucketExists) {
        console.log("Bucket 'documents' não encontrado, criando...");
        await supabase.functions.invoke('create-bucket', {
          body: { bucketName: 'documents' }
        });
      }

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', selectedClient.id);
        formData.append('documentType', documentType);
        formData.append('originalFilename', file.name);

        const uploadResponse = await supabase.functions.invoke('upload-document', {
          body: formData,
        });

        if (!uploadResponse.data) {
          throw new Error('Failed to upload document');
        }

        const filePath = uploadResponse.data.filePath;
        const { data } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        if (!data.publicUrl) {
          throw new Error('Failed to get file URL');
        }

        if (method === "email") {
          const sendResponse = await supabase.functions.invoke('send-document', {
            body: {
              clientEmail: selectedClient.email,
              clientName: selectedClient.name,
              documentType,
              filePath: filePath,
              fileName: file.name,
            },
          });

          if (!sendResponse.data) {
            throw new Error('Failed to send email');
          }
        } else if (method === "whatsapp") {
          const sendResponse = await supabase.functions.invoke('send-whatsapp', {
            body: {
              clientPhone: selectedClient.whatsapp,
              clientName: selectedClient.name,
              documentType,
              publicUrl: data.publicUrl,
              fileName: file.name,
            },
          });

          if (!sendResponse.data) {
            throw new Error('Failed to send WhatsApp message');
          }
        }
      }

      toast({
        title: "Sucesso",
        description: `${files.length} documento(s) ${method === 'email' ? 'enviado(s) por email' : 'enviado(s) por WhatsApp'}`,
      });

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

  return { handleUpload, handleSend };
}
