
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
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
  }, [selectedClient, documentType, resetPagination]);
  
  // Initial load and periodic refresh
  useEffect(() => {
    const loadFiles = async () => {
      try {
        // Check if bucket exists first
        const bucketExists = await checkBucketExists();
        if (bucketExists) {
          loadUploadedFiles();
          // If we have a previous bucket error but the bucket now exists, clear the error
          if (bucketError) {
            setBucketError(null);
          }
        } else if (!attemptedBucketCreation) {
          // Attempt to create the bucket if it doesn't exist and we haven't tried yet
          setAttemptedBucketCreation(true);
          const success = await checkAndCreateBucket();
          if (success) {
            loadUploadedFiles();
            setBucketError(null);
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

  // Function to manually check and create bucket
  const checkBucket = useCallback(async () => {
    setAttemptedBucketCreation(true);
    const success = await checkAndCreateBucket();
    if (success) {
      loadUploadedFiles(true);
      setBucketError(null);
      toast({
        title: "Sucesso",
        description: "Armazenamento preparado com sucesso",
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
