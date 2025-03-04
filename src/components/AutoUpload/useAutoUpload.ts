
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { UploadedFile } from "./FilesList";
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
    handleDeleteFile 
  } = useFileManagement({ 
    selectedClient, 
    documentType 
  });

  const handleForceRefresh = useCallback(() => {
    loadUploadedFiles();
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
    onUploadComplete: loadUploadedFiles 
  });

  // Handle file upload (wrapper to maintain the original API)
  const handleUploadTest = useCallback((files: FileList) => {
    return handleUploadInternal(files);
  }, [handleUploadInternal]);

  // Set up automatic refresh and initial load
  useEffect(() => {
    loadUploadedFiles();
    
    // Set up interval to refresh files periodically
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [selectedClient, documentType, loadUploadedFiles, refreshTrigger]);

  return {
    isLoading,
    isLoadingFiles,
    uploadedFiles,
    handleUploadTest,
    handleDeleteFile,
    handleForceRefresh,
  };
}
