
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useBucketManagement() {
  const { toast } = useToast();
  const [isBucketReady, setIsBucketReady] = useState(false);
  
  // Verify and create bucket if necessary with retry mechanism
  const checkAndCreateBucket = useCallback(async (retryCount = 3) => {
    try {
      console.log("Verificando existência do bucket 'documents'");
      
      // First, check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Erro ao listar buckets:", listError);
        throw new Error(`Falha ao verificar buckets: ${listError.message}`);
      }
      
      const bucketExists = buckets?.some(bucket => bucket.name === 'documents');
      
      if (bucketExists) {
        console.log("Bucket 'documents' já existe");
        setIsBucketReady(true);
        return true;
      }
      
      console.log("Bucket 'documents' não encontrado, tentando criar via edge function");
      
      // Create bucket via edge function
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents' }
      });
      
      if (!response.data?.success) {
        console.error("Erro ao criar bucket:", response.error || response.data);
        throw new Error(`Falha ao criar bucket: ${response.error?.message || 'resposta inválida'}`);
      }
      
      // Double-check that bucket was created successfully
      const { data: verifyBuckets, error: verifyError } = await supabase.storage.listBuckets();
      
      if (verifyError) {
        console.error("Erro ao verificar criação do bucket:", verifyError);
        throw new Error(`Falha ao verificar criação do bucket: ${verifyError.message}`);
      }
      
      const bucketCreated = verifyBuckets?.some(bucket => bucket.name === 'documents');
      
      if (!bucketCreated) {
        throw new Error("Bucket não foi criado corretamente");
      }
      
      console.log("Bucket 'documents' foi criado com sucesso e está pronto para uso");
      setIsBucketReady(true);
      return true;
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
      
      // Retry logic
      if (retryCount > 0) {
        console.log(`Tentando novamente (${retryCount} tentativas restantes)...`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        return checkAndCreateBucket(retryCount - 1);
      }
      
      toast({
        title: "Erro de armazenamento",
        description: `Não foi possível preparar o armazenamento: ${error.message}`,
        variant: "destructive",
      });
      setIsBucketReady(false);
      return false;
    }
  }, [toast]);

  return {
    checkAndCreateBucket,
    isBucketReady
  };
}
