
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

  // Helper function to check and create a bucket if it doesn't exist
  const ensureBucketExists = async (bucketName: string) => {
    try {
      console.log(`Verificando existência do bucket: ${bucketName}`);
      
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.error("Erro ao verificar buckets:", bucketsError);
        throw new Error('Falha ao verificar buckets de armazenamento');
      }
      
      const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`Bucket '${bucketName}' não encontrado, criando...`);
        
        // Create bucket via edge function
        const createResponse = await supabase.functions.invoke('create-bucket', {
          body: { bucketName }
        });
        
        if (createResponse.error) {
          console.error("Erro ao criar bucket:", createResponse.error);
          throw new Error(`Falha ao criar bucket ${bucketName}: ${createResponse.error.message}`);
        }
        
        console.log(`Resposta da criação do bucket:`, createResponse.data);
        
        // Double check that the bucket was created
        const { data: checkBuckets, error: checkError } = await supabase.storage.listBuckets();
        
        if (checkError) {
          console.error("Erro ao verificar se o bucket foi criado:", checkError);
          throw new Error('Falha ao verificar a criação do bucket');
        }
        
        const bucketCreated = checkBuckets?.some(bucket => bucket.name === bucketName);
        
        if (!bucketCreated) {
          console.error(`Bucket '${bucketName}' não foi criado apesar da resposta positiva`);
          throw new Error('Falha ao criar bucket: não encontrado após criação');
        }
        
        console.log(`Bucket '${bucketName}' criado com sucesso!`);
      } else {
        console.log(`Bucket '${bucketName}' já existe`);
      }
      
      return true;
    } catch (error) {
      console.error("Erro ao garantir existência do bucket:", error);
      throw error;
    }
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
      // Ensure documents bucket exists
      await ensureBucketExists('documents');

      // Now proceed with file uploads
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientId', selectedClient.id);
        formData.append('documentType', documentType);
        formData.append('originalFilename', file.name);

        console.log(`Enviando arquivo: ${file.name}, tipo: ${documentType}, cliente: ${selectedClient.id}`);
        
        const uploadResponse = await supabase.functions.invoke('upload-document', {
          body: formData,
        });

        if (uploadResponse.error) {
          console.error("Erro ao fazer upload:", uploadResponse.error);
          throw new Error(`Falha ao enviar documento: ${uploadResponse.error.message}`);
        }

        if (!uploadResponse.data) {
          throw new Error('Resposta de upload vazia');
        }

        console.log("Resposta do upload:", uploadResponse.data);
        const filePath = uploadResponse.data.filePath;
        
        // Fixed: The getPublicUrl method returns an object with a data property that contains publicUrl
        // It doesn't have an error property according to the type definition
        const { data } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        if (!data.publicUrl) {
          throw new Error('URL pública não disponível');
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

          if (sendResponse.error || !sendResponse.data) {
            console.error("Erro ao enviar email:", sendResponse.error);
            throw new Error('Falha ao enviar email');
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

          if (sendResponse.error || !sendResponse.data) {
            console.error("Erro ao enviar WhatsApp:", sendResponse.error);
            throw new Error('Falha ao enviar WhatsApp');
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
        description: `Erro ao ${method === 'email' ? 'enviar email' : 'enviar WhatsApp'}: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { handleUpload, handleSend };
}
