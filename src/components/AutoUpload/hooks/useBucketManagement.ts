
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useBucketManagement() {
  const { toast } = useToast();
  
  // Verify and create bucket if necessary
  const checkAndCreateBucket = async () => {
    try {
      console.log("Verificando existência do bucket 'documents'");
      
      // Create bucket via edge function
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents' }
      });
      
      if (!response.data?.success) {
        console.error("Erro ao criar bucket:", response.error || response.data);
        throw new Error(`Falha ao criar bucket: ${response.error?.message || 'resposta inválida'}`);
      }
      
      console.log("Bucket 'documents' está pronto para uso");
      return true;
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
      toast({
        title: "Erro",
        description: `Falha ao verificar/criar bucket: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    checkAndCreateBucket,
  };
}
