
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function useBucketManagement() {
  const { toast } = useToast();
  const [isBucketReady, setIsBucketReady] = useState(false);
  const [isCheckingBucket, setIsCheckingBucket] = useState(false);
  
  // Verify and create bucket if necessary with improved retry mechanism
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
      
      // Check if buckets response is valid
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
      
      // Create bucket via edge function with improved error handling
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents' }
      });
      
      console.log("Resposta da edge function create-bucket:", response);
      
      if (!response.data) {
        throw new Error("Resposta inválida da função create-bucket");
      }
      
      // Check if the response indicates success
      if (response.data?.success) {
        console.log("Bucket criado ou já existente:", response.data);
        
        // Increased delay to ensure bucket creation has propagated
        await new Promise(resolve => setTimeout(resolve, 3000));
        
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
          console.log("Bucket 'documents' foi criado/encontrado com sucesso:", verifiedBucket);
          
          // Remove the incorrect setPublic call since this method doesn't exist
          // Instead, we rely on the edge function to set the bucket as public
          console.log("Confiando que o bucket 'documents' foi definido como público pela edge function");
          
          setIsBucketReady(true);
          return true;
        } else {
          console.error("Bucket não encontrado após tentativa de criação/verificação");
          throw new Error("Bucket não foi criado corretamente");
        }
      } else {
        console.error("Erro ao criar bucket:", response.error || "resposta inválida");
        throw new Error(`Falha ao criar bucket: ${response.error?.message || response.data?.error || 'resposta inválida'}`);
      }
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
      
      // Retry logic with increased delay between retries
      if (retryCount > 0) {
        console.log(`Tentando novamente (${retryCount} tentativas restantes)...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
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
      console.log("Verificando se o bucket 'documents' existe");
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        console.error("Erro ao listar buckets:", error);
        return false;
      }
      
      if (!buckets) {
        console.error("Resposta de buckets vazia");
        return false;
      }
      
      const exists = buckets.some(bucket => bucket.name === 'documents');
      console.log(`Bucket 'documents' ${exists ? 'existe' : 'não existe'}`);
      
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
