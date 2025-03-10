
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Client, DocumentType } from "@/types/client";
import { useFileManagement } from "./hooks/useFileManagement";
import { useFileUpload } from "./hooks/useFileUpload";
import { useBucketManagement } from "./hooks/useBucketManagement";

interface UseAutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function useAutoUpload({ selectedClient, documentType }: UseAutoUploadProps) {
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [attemptedBucketCreation, setAttemptedBucketCreation] = useState(false);

  const { 
    checkAndCreateBucket,
    checkBucketExists,
    isCheckingBucket,
    isBucketReady
  } = useBucketManagement();

  const { 
    isLoadingFiles, 
    uploadedFiles, 
    loadUploadedFiles, 
    handleDeleteFile,
    loadMoreFiles,
    hasMoreFiles,
    resetPagination,
    getFileByPath,
    bucketError,
    setBucketError
  } = useFileManagement({ 
    selectedClient, 
    documentType 
  });

  const handleForceRefresh = useCallback(() => {
    loadUploadedFiles(true); // true means force refresh, ignore cache
    toast({
      title: "Atualizando",
      description: "Atualizando lista de arquivos...",
    });
  }, [loadUploadedFiles, toast]);

  const { 
    isLoading, 
    handleUpload: handleUploadInternal 
  } = useFileUpload({ 
    selectedClient, 
    documentType, 
    onUploadComplete: handleForceRefresh // Use force refresh after upload for immediate feedback
  });

  // Handle file upload (wrapper to maintain the original API)
  const handleUploadTest = useCallback((files: FileList) => {
    return handleUploadInternal(files);
  }, [handleUploadInternal]);

  // Reset pagination and cache when client or document type changes
  useEffect(() => {
    resetPagination();
    setAttemptedBucketCreation(false); // Reset attempt flag when dependencies change
  }, [selectedClient, documentType, resetPagination]);
  
  // Initial load and periodic refresh with improved bucket initialization
  useEffect(() => {
    const loadFiles = async () => {
      try {
        console.log("Verificando bucket antes de carregar arquivos");
        
        // First try creating bucket directly - more reliable
        try {
          console.log("Tentando criar bucket documents diretamente");
          const { error: createError } = await supabase.storage.createBucket('documents', {
            public: true
          });
          
          if (createError) {
            if (createError.message.includes('already exists')) {
              console.log("Bucket já existe (confirmado via tentativa de criação)");
              setBucketError(null);
            } else {
              console.error("Erro ao criar bucket diretamente:", createError);
              // Continue to next approach
            }
          } else {
            console.log("Bucket criado com sucesso via método direto");
            setBucketError(null);
          }
        } catch (directError) {
          console.error("Erro na tentativa direta:", directError);
          // Continue to next approach
        }
        
        // Check if bucket exists
        const bucketExists = await checkBucketExists();
        if (bucketExists) {
          console.log("Bucket existe, carregando arquivos");
          loadUploadedFiles();
          // If we have a previous bucket error but the bucket now exists, clear the error
          if (bucketError) {
            setBucketError(null);
          }
        } else if (!attemptedBucketCreation) {
          // Attempt to create the bucket if it doesn't exist and we haven't tried yet
          console.log("Bucket não existe, tentando criar");
          setAttemptedBucketCreation(true);
          const success = await checkAndCreateBucket(3); // 3 retries
          if (success) {
            console.log("Bucket criado com sucesso, carregando arquivos");
            loadUploadedFiles();
            setBucketError(null);
          } else {
            console.error("Falha ao criar bucket");
          }
        }
      } catch (error) {
        console.error("Error in loadFiles:", error);
      }
    };
    
    loadFiles();
    
    // Set up interval to refresh files periodically, but don't force refresh
    // to use the cache when available
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Refresh every 60 seconds
    
    return () => clearInterval(intervalId);
  }, [loadUploadedFiles, refreshTrigger, checkBucketExists, checkAndCreateBucket, bucketError, setBucketError, attemptedBucketCreation]);

  // Function to manually check and create bucket with more robust approach
  const checkBucket = useCallback(async () => {
    setAttemptedBucketCreation(true);
    console.log("Tentativa manual de criar bucket");
    
    // First try direct create
    try {
      console.log("Tentando criar bucket documents diretamente");
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: true
      });
      
      if (createError) {
        if (createError.message.includes('already exists')) {
          console.log("Bucket já existe (confirmado via tentativa de criação)");
          // Success case
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
    
    // Then use our utility function for additional checks and retries
    const success = await checkAndCreateBucket(3); // 3 retries
    if (success) {
      console.log("Bucket criado manualmente com sucesso");
      loadUploadedFiles(true);
      setBucketError(null);
      toast({
        title: "Sucesso",
        description: "Armazenamento preparado com sucesso",
      });
    } else {
      console.error("Falha ao criar bucket manualmente");
      toast({
        title: "Erro",
        description: "Não foi possível preparar o armazenamento",
        variant: "destructive",
      });
    }
    return success;
  }, [checkAndCreateBucket, loadUploadedFiles, toast, setBucketError]);

  return {
    isLoading: isLoading || isCheckingBucket,
    isLoadingFiles,
    uploadedFiles,
    hasMoreFiles,
    handleUploadTest,
    handleDeleteFile,
    handleForceRefresh,
    loadMoreFiles,
    getFileByPath,
    bucketError,
    checkBucket,
    isBucketReady
  };
}
