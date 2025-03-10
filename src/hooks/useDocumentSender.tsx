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
      
      // First check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Erro ao listar buckets:", listError);
        throw new Error(`Falha ao verificar buckets: ${listError.message}`);
      }
      
      if (!buckets) {
        console.error("Resposta de buckets vazia");
        throw new Error("Resposta de buckets vazia");
      }
      
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (bucketExists) {
        console.log(`Bucket '${bucketName}' já existe`);
        
        // Remove the incorrect setPublic call
        // We'll rely on the bucket being created as public by the edge function
        console.log(`Confiando que o bucket '${bucketName}' já está configurado como público`);
        
        return true;
      }
      
      console.log(`Bucket '${bucketName}' não encontrado, tentando criar via edge function`);
      
      // Create bucket via edge function
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName }
      });
      
      console.log("Resposta da função create-bucket:", response);
      
      if (!response.data) {
        throw new Error("Resposta vazia da função create-bucket");
      }
      
      if (!response.data?.success) {
        console.error("Resposta inesperada ao criar bucket:", response.data);
        throw new Error(`Falha ao criar bucket ${bucketName}: resposta inválida`);
      }
      
      // Delay to ensure bucket creation has propagated
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Double-check that bucket was created successfully
      const { data: verifyBuckets, error: verifyError } = await supabase.storage.listBuckets();
      
      if (verifyError) {
        console.error("Erro ao verificar criação do bucket:", verifyError);
        throw new Error(`Falha ao verificar criação do bucket: ${verifyError.message}`);
      }
      
      if (!verifyBuckets) {
        throw new Error("Resposta de verificação vazia");
      }
      
      const bucketCreated = verifyBuckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketCreated) {
        throw new Error(`Bucket '${bucketName}' não foi criado corretamente`);
      }
      
      console.log(`Bucket '${bucketName}' foi criado com sucesso e está pronto para uso`);
      return true;
    } catch (error) {
      console.error("Erro ao garantir existência do bucket:", error);
      
      // One more retry with direct API call as fallback
      try {
        console.log("Tentando criar bucket diretamente como fallback...");
        await supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        // Verify again
        const { data: retryBuckets } = await supabase.storage.listBuckets();
        const bucketCreated = retryBuckets?.some(bucket => bucket.name === bucketName);
        
        if (bucketCreated) {
          console.log("Bucket criado com sucesso pelo método fallback");
          return true;
        }
      } catch (fallbackError) {
        console.error("Erro no método fallback:", fallbackError);
      }
      
      throw error;
    }
  };

  // New method to send files that are already uploaded (from auto upload)
  const handleSendUploadedFiles = async (
    method: "email" | "whatsapp", 
    uploadedFiles: {path: string, name: string, url: string}[]
  ) => {
    if (!selectedClient || !uploadedFiles || uploadedFiles.length === 0) {
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

      // Proceed with sending already uploaded files
      for (const file of uploadedFiles) {
        if (method === "email") {
          console.log(`Enviando ${file.name} por email para ${selectedClient.name} (${selectedClient.email})`);
          const sendResponse = await supabase.functions.invoke('send-document', {
            body: {
              clientEmail: selectedClient.email,
              clientName: selectedClient.name,
              documentType,
              filePath: file.path,
              fileName: file.name,
            },
          });

          if (sendResponse.error || !sendResponse.data) {
            console.error("Erro ao enviar email:", sendResponse.error || sendResponse);
            throw new Error('Falha ao enviar email');
          }
        } else if (method === "whatsapp") {
          console.log(`Enviando ${file.name} por WhatsApp para ${selectedClient.name} (${selectedClient.whatsapp})`);
          const sendResponse = await supabase.functions.invoke('send-whatsapp', {
            body: {
              clientPhone: selectedClient.whatsapp,
              clientName: selectedClient.name,
              documentType,
              publicUrl: file.url,
              fileName: file.name,
            },
          });

          if (sendResponse.error || !sendResponse.data) {
            console.error("Erro ao enviar WhatsApp:", sendResponse.error || sendResponse);
            throw new Error('Falha ao enviar WhatsApp');
          }
        }
      }

      toast({
        title: "Sucesso",
        description: `${uploadedFiles.length} documento(s) ${method === 'email' ? 'enviado(s) por email' : 'enviado(s) por WhatsApp'}`,
      });
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
      // Ensure documents bucket exists with improved error handling
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
        
        // Get public URL
        const { data } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        if (!data || !data.publicUrl) {
          console.error("Falha ao obter URL pública", data);
          throw new Error('URL pública não disponível');
        }

        if (method === "email") {
          console.log(`Enviando ${file.name} por email para ${selectedClient.name} (${selectedClient.email})`);
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
            console.error("Erro ao enviar email:", sendResponse.error || sendResponse);
            throw new Error('Falha ao enviar email');
          }
        } else if (method === "whatsapp") {
          console.log(`Enviando ${file.name} por WhatsApp para ${selectedClient.name} (${selectedClient.whatsapp})`);
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
            console.error("Erro ao enviar WhatsApp:", sendResponse.error || sendResponse);
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

  return { handleUpload, handleSend, handleSendUploadedFiles };
}
