
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { useFileManagement } from "./hooks/useFileManagement";
import { useFileUpload } from "./hooks/useFileUpload";

interface UseAutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function useAutoUpload({ selectedClient, documentType }: UseAutoUploadProps) {
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { 
    isLoadingFiles, 
    uploadedFiles, 
    loadUploadedFiles, 
    handleDeleteFile,
    loadMoreFiles,
    hasMoreFiles,
    resetPagination,
    getFileByPath,
    bucketError
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
    loadUploadedFiles();
    
    // Set up interval to refresh files periodically, but don't force refresh
    // to use the cache when available
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 60000); // Refresh every 60 seconds
    
    return () => clearInterval(intervalId);
  }, [loadUploadedFiles, refreshTrigger]);

  return {
    isLoading,
    isLoadingFiles,
    uploadedFiles,
    hasMoreFiles,
    handleUploadTest,
    handleDeleteFile,
    handleForceRefresh,
    loadMoreFiles,
    getFileByPath,
    bucketError
  };
}
