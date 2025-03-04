
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Client, DocumentType } from "@/types/client";
import { useBucketManagement } from "./useBucketManagement";

export function useFileUpload({ 
  selectedClient, 
  documentType,
  onUploadComplete 
}: { 
  selectedClient: Client | null;
  documentType: DocumentType;
  onUploadComplete: () => void;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { checkAndCreateBucket } = useBucketManagement();

  // Handle file upload
  const handleUpload = async (files: FileList) => {
    setIsLoading(true);
    
    try {
      // Make sure bucket exists before attempting upload
      const bucketReady = await checkAndCreateBucket();
      if (!bucketReady) {
        throw new Error("Não foi possível criar ou verificar o bucket");
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const file of Array.from(files)) {
        try {
          console.log(`Preparando upload para: ${file.name}`);
          
          const formData = new FormData();
          formData.append('file', file);
          
          if (selectedClient) {
            formData.append('clientId', selectedClient.id);
          }
          
          formData.append('documentType', documentType);
          formData.append('originalFilename', file.name); // Add original filename

          // Call edge function for upload
          console.log("Enviando arquivo para a edge function upload-auto");
          const response = await supabase.functions.invoke('upload-auto', {
            body: formData,
          });

          if (response.error) {
            console.error("Erro na resposta da função:", response.error);
            throw new Error(response.error.message);
          }

          console.log("Resposta da função:", response.data);
          successCount++;
          
          toast({
            title: "Sucesso",
            description: `Arquivo ${file.name} enviado com sucesso`,
          });
        } catch (fileError) {
          console.error(`Erro ao processar arquivo ${file.name}:`, fileError);
          errorCount++;
        }
      }
      
      // Final summary
      if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Upload Parcial",
          description: `${successCount} arquivo(s) enviado(s) com sucesso, ${errorCount} falha(s)`,
          variant: "default",
        });
      } else if (successCount > 0) {
        toast({
          title: "Sucesso",
          description: `${successCount} arquivo(s) enviado(s) com sucesso`,
        });
      } else if (errorCount > 0) {
        toast({
          title: "Erro",
          description: `Falha ao enviar ${errorCount} arquivo(s)`,
          variant: "destructive",
        });
      }
      
      // Call the completion callback to refresh files
      onUploadComplete();
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: "Erro",
        description: `Falha ao enviar arquivo: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    handleUpload
  };
}
