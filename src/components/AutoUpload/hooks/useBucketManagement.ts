
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useBucketManagement() {
  const { toast } = useToast();
  const [isBucketReady, setIsBucketReady] = useState(false);
  const [isCheckingBucket, setIsCheckingBucket] = useState(false);
  
  // Verify and create bucket if necessary with retry mechanism
  const checkAndCreateBucket = useCallback(async (retryCount = 3) => {
    setIsCheckingBucket(true);
    
    try {
      console.log("Verificando existência do bucket 'documents'");
      
      // First, check if bucket already exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Erro ao listar buckets:", listError);
        throw new Error(`Falha ao verificar buckets: ${listError.message}`);
      }
      
      // Check if buckets response is valid and contains the documents bucket
      if (!buckets) {
        console.error("Resposta de buckets vazia ou inválida");
        throw new Error("Resposta de buckets inválida");
      }
      
      const documentsBucket = buckets.find(bucket => bucket.name === 'documents');
      
      if (documentsBucket) {
        console.log("Bucket 'documents' encontrado:", documentsBucket);
        setIsBucketReady(true);
        return true;
      }
      
      console.log("Bucket 'documents' não encontrado, tentando criar via edge function");
      
      // Create bucket via edge function
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents' }
      });
      
      console.log("Resposta da edge function create-bucket:", response);
      
      // Check if the response indicates success (either created or already exists)
      if (response.data?.success) {
        console.log("Bucket criado ou já existente:", response.data);
        
        // Delay verification to ensure bucket creation has propagated
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Double-check that bucket was created successfully
        const { data: verifyBuckets, error: verifyError } = await supabase.storage.listBuckets();
        
        if (verifyError) {
          console.error("Erro ao verificar criação do bucket:", verifyError);
          throw new Error(`Falha ao verificar criação do bucket: ${verifyError.message}`);
        }
        
        if (!verifyBuckets) {
          throw new Error("Resposta de verificação inválida");
        }
        
        const verifiedBucket = verifyBuckets.find(bucket => bucket.name === 'documents');
        
        if (verifiedBucket) {
          console.log("Bucket 'documents' foi criado/encontrado com sucesso e está pronto para uso:", verifiedBucket);
          setIsBucketReady(true);
          return true;
        } else {
          console.error("Bucket não encontrado após tentativa de criação/verificação");
          throw new Error("Bucket não foi criado corretamente");
        }
      } else {
        console.error("Erro ao criar bucket:", response.error || "resposta inválida");
        throw new Error(`Falha ao criar bucket: ${response.error?.message || 'resposta inválida'}`);
      }
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
      
      // Retry logic
      if (retryCount > 0) {
        console.log(`Tentando novamente (${retryCount} tentativas restantes)...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        return checkAndCreateBucket(retryCount - 1);
      }
      
      toast({
        title: "Erro de armazenamento",
        description: `Não foi possível preparar o armazenamento: ${error.message}`,
        variant: "destructive",
      });
      setIsBucketReady(false);
      return false;
    } finally {
      setIsCheckingBucket(false);
    }
  }, [toast]);

  // Check if the bucket exists without attempting to create it
  const checkBucketExists = useCallback(async () => {
    try {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.error("Erro ao listar buckets:", error);
        return false;
      }
      
      if (!buckets) {
        return false;
      }
      
      const exists = buckets.some(bucket => bucket.name === 'documents');
      if (exists) {
        setIsBucketReady(true);
      }
      return exists;
    } catch (error) {
      console.error("Erro ao verificar existência do bucket:", error);
      return false;
    }
  }, []);

  return {
    checkAndCreateBucket,
    checkBucketExists,
    isBucketReady,
    isCheckingBucket,
    setIsBucketReady
  };
}
