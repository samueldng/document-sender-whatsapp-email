
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
      
      // First, try direct bucket creation as it's the most reliable approach
      // This will either create the bucket or return "already exists" error
      try {
        console.log("Tentando criar bucket diretamente");
        const { error: createError } = await supabase.storage.createBucket('documents', {
          public: true
        });
        
        if (createError) {
          if (createError.message.includes('already exists')) {
            console.log("Bucket já existe (confirmado via tentativa de criação)");
            // Success case - bucket already exists
          } else {
            console.error("Erro ao criar bucket diretamente:", createError);
            // Continue to next approach
          }
        } else {
          console.log("Bucket criado com sucesso via método direto");
        }
      } catch (directError) {
        console.error("Erro na tentativa direta:", directError);
        // Continue to next approach
      }
      
      // Check if bucket exists using edge function (backup approach)
      const { data: response, error: invokeError } = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents', create: true }
      });
      
      if (invokeError) {
        console.error("Erro ao verificar bucket via edge function:", invokeError);
        // Continue to next approach
      } else {
        console.log("Resposta da edge function:", response);
      }
      
      // Verify bucket actually works by doing a test upload
      try {
        console.log("Verificando acesso ao bucket com upload de teste");
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
        
        // Try to get public URL for test file
        const publicUrlResult = await supabase.storage
          .from('documents')
          .getPublicUrl(testPath);
          
        if (!publicUrlResult.data || !publicUrlResult.data.publicUrl) {
          console.error("Erro ao obter URL pública: URL não disponível");
        } else {
          console.log("URL pública obtida:", publicUrlResult.data.publicUrl);
          
          // Verify URL is accessible by making a HEAD request
          try {
            const urlCheckResponse = await fetch(publicUrlResult.data.publicUrl, { 
              method: 'HEAD',
              cache: 'no-store'
            });
            if (urlCheckResponse.ok) {
              console.log("URL é acessível:", urlCheckResponse.status);
            } else {
              console.error("URL não é acessível:", urlCheckResponse.status);
            }
          } catch (urlCheckError) {
            console.error("Erro ao verificar URL:", urlCheckError);
          }
        }
        
        // Clean up test file
        await supabase.storage.from('documents').remove([testPath]);
        console.log("Bucket está operacional - upload de teste bem-sucedido");
        setIsBucketReady(true);
        return true;
      } catch (testError) {
        console.warn("Aviso: Teste de upload falhou, tentando abordagem alternativa", testError);
        
        // Try a different test file name as a last resort
        try {
          console.log("Tentando com um nome de arquivo diferente");
          const altTestFile = new Blob(['test-alt'], { type: 'text/plain' });
          const altTestPath = `alt-test-${Date.now()}.txt`;
          
          const { data: altUpload, error: altError } = await supabase.storage
            .from('documents')
            .upload(altTestPath, altTestFile, { upsert: true });
            
          if (altError) {
            console.error("Erro no upload alternativo:", altError);
            throw new Error(`Falha no teste alternativo: ${altError.message}`);
          }
          
          console.log("Upload alternativo bem-sucedido:", altUpload);
          await supabase.storage.from('documents').remove([altTestPath]);
          setIsBucketReady(true);
          return true;
        } catch (altError) {
          console.error("Erro no teste alternativo:", altError);
          throw new Error(`Falha nos testes de bucket: ${altError.message}`);
        }
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
      
      // Try to get bucket info directly
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error("Erro ao listar buckets:", listError);
      } else {
        const exists = buckets?.some(bucket => bucket.name === 'documents');
        console.log(`Bucket 'documents' ${exists ? 'existe' : 'não existe'} segundo listBuckets`);
        
        if (exists) {
          // Double check with a test upload
          try {
            const testFile = new Blob(['check'], { type: 'text/plain' });
            const testPath = `check-${Date.now()}.txt`;
            
            const { error: testError } = await supabase.storage
              .from('documents')
              .upload(testPath, testFile, { upsert: true });
              
            if (testError) {
              console.error("Bucket existe mas não permite upload:", testError);
              return false;
            }
            
            await supabase.storage.from('documents').remove([testPath]);
            setIsBucketReady(true);
            return true;
          } catch (testError) {
            console.error("Erro no teste de acesso:", testError);
            return false;
          }
        }
      }
      
      // Use the edge function as backup to check if bucket exists
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
