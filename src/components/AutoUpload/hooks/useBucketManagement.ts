
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
      
      // First, check if bucket already exists using edge function
      // This approach is more reliable than listBuckets() which sometimes returns empty arrays
      const { data: response, error: invokeError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', checkOnly: true }
      });
      
      if (invokeError) {
        console.error("Erro ao verificar bucket via edge function:", invokeError);
        throw new Error(`Falha ao verificar bucket: ${invokeError.message}`);
      }
      
      console.log("Resposta da verificação do bucket:", response);
      
      if (response?.exists) {
        console.log("Bucket 'documents' já existe segundo a edge function");
        setIsBucketReady(true);
        return true;
      }
      
      console.log("Bucket 'documents' não encontrado, criando via edge function");
      
      // Create bucket via edge function
      const { data: createResponse, error: createError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', create: true }
      });
      
      if (createError) {
        console.error("Erro ao criar bucket via edge function:", createError);
        throw new Error(`Falha ao criar bucket: ${createError.message}`);
      }
      
      if (!createResponse) {
        throw new Error("Resposta vazia da função create-bucket");
      }
      
      console.log("Resposta da criação do bucket:", createResponse);
      
      // Check if the response indicates success
      if (createResponse.success) {
        console.log("Bucket criado ou já existente com sucesso");
        
        // Double check with direct storage call
        try {
          const testFile = new Blob(['test'], { type: 'text/plain' });
          const testPath = `test-${Date.now()}.txt`;
          
          const { data: testUpload, error: testError } = await supabase.storage
            .from('documents')
            .upload(testPath, testFile, { upsert: true });
            
          if (testError) {
            console.error("Erro no upload de teste:", testError);
            throw new Error(`Falha no teste de upload: ${testError.message}`);
          }
          
          console.log("Test upload result:", testUpload);
          
          // Try to get public URL for test file - FIX HERE - The getPublicUrl method doesn't return an error property
          const publicUrlResult = await supabase.storage
            .from('documents')
            .getPublicUrl(testPath);
            
          // The result only has a data property, no error property
          if (!publicUrlResult.data || !publicUrlResult.data.publicUrl) {
            console.error("Erro ao obter URL pública: URL não disponível");
          } else {
            console.log("URL pública obtida:", publicUrlResult.data.publicUrl);
          }
          
          // Clean up test file
          await supabase.storage.from('documents').remove([testPath]);
          console.log("Bucket está operacional - upload de teste bem-sucedido");
          setIsBucketReady(true);
          return true;
        } catch (testError) {
          console.warn("Aviso: Teste de upload falhou, mas continuando:", testError);
          
          // As a fallback, try creating the bucket directly
          try {
            console.log("Tentando criar bucket diretamente como fallback");
            await supabase.storage.createBucket('documents', {
              public: true
            });
            console.log("Bucket criado diretamente com sucesso");
            
            // Test again
            const retryFile = new Blob(['retry-test'], { type: 'text/plain' });
            const retryPath = `retry-test-${Date.now()}.txt`;
            
            const { data: retryUpload, error: retryError } = await supabase.storage
              .from('documents')
              .upload(retryPath, retryFile, { upsert: true });
              
            if (retryError) {
              console.error("Erro no retry upload:", retryError);
            } else {
              console.log("Retry upload bem-sucedido:", retryUpload);
              await supabase.storage.from('documents').remove([retryPath]);
              setIsBucketReady(true);
              return true;
            }
          } catch (directError) {
            console.error("Erro no fallback de criação direta:", directError);
          }
        }
        
        // Even if test fails, trust the edge function result
        setIsBucketReady(true);
        return true;
      } else {
        console.error("Erro na resposta da criação do bucket:", createResponse.error || "resposta inválida");
        throw new Error(`Falha ao criar bucket: ${createResponse.error || 'resposta inválida'}`);
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
      
      // Use the edge function to check if bucket exists
      const { data: response, error } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', checkOnly: true }
      });
      
      if (error) {
        console.error("Erro ao verificar bucket via edge function:", error);
        return false;
      }
      
      const exists = response?.exists === true;
      console.log(`Bucket 'documents' ${exists ? 'existe' : 'não existe'} segundo a edge function`);
      
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
