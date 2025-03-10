
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
      
      // Use edge function to check and create bucket if needed
      const { data: response, error: invokeError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName, create: true }
      });
      
      if (invokeError) {
        console.error("Erro ao verificar/criar bucket via edge function:", invokeError);
        throw new Error(`Falha ao verificar/criar bucket: ${invokeError.message}`);
      }
      
      if (!response?.success) {
        console.error("Resposta inválida da função create-bucket:", response);
        throw new Error(`Falha ao verificar/criar bucket: resposta inválida`);
      }
      
      console.log("Resposta da verificação/criação do bucket:", response);
      
      // Verify bucket access with a test
      try {
        // Try a small test upload to verify we can use the bucket
        const testFile = new Blob(['test'], { type: 'text/plain' });
        const testPath = `test-${Date.now()}.txt`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(testPath, testFile);
          
        if (uploadError) {
          console.warn("Aviso: Teste de upload falhou:", uploadError);
          // Continue anyway as the bucket might still work
        } else {
          console.log("Teste de upload bem-sucedido:", uploadData);
          // Clean up test file
          await supabase.storage.from(bucketName).remove([testPath]);
        }
      } catch (testError) {
        console.warn("Aviso: Erro durante teste de acesso ao bucket:", testError);
        // Continue anyway
      }
      
      return true;
    } catch (error) {
      console.error("Erro ao garantir existência do bucket:", error);
      
      // One more retry with direct API call as fallback
      try {
        console.log("Tentando verificar bucket diretamente como fallback...");
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
        
        if (bucketExists) {
          console.log("Bucket existe segundo verificação direta");
          return true;
        }
        
        console.log("Bucket não existe, tentando criar diretamente...");
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
        const publicUrl = uploadResponse.data.publicUrl;
        
        // If we don't have a publicUrl from the upload, try to get it
        let url = publicUrl;
        if (!url) {
          // Get public URL
          const { data } = await supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

          if (!data || !data.publicUrl) {
            console.error("Falha ao obter URL pública", data);
            throw new Error('URL pública não disponível');
          }
          
          url = data.publicUrl;
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
              publicUrl: url,
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
