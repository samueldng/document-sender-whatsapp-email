
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import UploadArea from "./UploadArea";
import FilesList from "./FilesList";
import { Client, DocumentType } from "@/types/client";
import { useAutoUpload } from "./useAutoUpload";
import { useSendDocument } from "@/hooks/useDocumentSender";

interface AutoUploadProps {
  selectedClient: Client;
  documentType: DocumentType;
}

export default function AutoUpload({ selectedClient, documentType }: AutoUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showActions, setShowActions] = useState(false);

  const {
    isLoading,
    isLoadingFiles,
    uploadedFiles,
    hasMoreFiles,
    handleUploadTest,
    handleDeleteFile,
    handleForceRefresh,
    loadMoreFiles,
    getFileByPath,
    bucketError,
    checkBucket
  } = useAutoUpload({
    selectedClient,
    documentType
  });

  const { handleSendUploadedFiles } = useSendDocument();

  useEffect(() => {
    // Reset selected files when client or document type changes
    setSelectedFiles([]);
    setShowActions(false);
  }, [selectedClient, documentType]);

  const handleFileSelect = (filePath: string, isSelected: boolean) => {
    setSelectedFiles(prevSelected => {
      const newSelected = isSelected
        ? [...prevSelected, filePath]
        : prevSelected.filter(path => path !== filePath);
      
      setShowActions(newSelected.length > 0);
      return newSelected;
    });
  };

  // Display bucket error alert if there's an error
  if (bucketError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Erro de armazenamento</AlertTitle>
          <AlertDescription>{bucketError}</AlertDescription>
        </Alert>
        
        <Button 
          className="w-full" 
          onClick={checkBucket}
          disabled={isLoading}
        >
          <RefreshCwIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const handleSendEmail = async () => {
    if (selectedFiles.length === 0) return;
    
    const selectedFilesData = selectedFiles.map(path => {
      const fileData = getFileByPath(path);
      if (!fileData) return null;
      return fileData;
    }).filter(Boolean);

    await handleSendUploadedFiles("email", selectedFilesData);
    
    // Reset selection after sending
    setSelectedFiles([]);
    setShowActions(false);
  };

  const handleSendWhatsApp = async () => {
    if (selectedFiles.length === 0) return;
    
    const selectedFilesData = selectedFiles.map(path => {
      const fileData = getFileByPath(path);
      if (!fileData) return null;
      return fileData;
    }).filter(Boolean);

    await handleSendUploadedFiles("whatsapp", selectedFilesData);
    
    // Reset selection after sending
    setSelectedFiles([]);
    setShowActions(false);
  };

  return (
    <div className="space-y-4">
      <UploadArea 
        handleUpload={handleUploadTest} 
        isLoading={isLoading} 
        disabled={!!bucketError}
      />
      
      <FilesList
        files={uploadedFiles}
        isLoading={isLoadingFiles}
        onDelete={handleDeleteFile}
        onRefresh={handleForceRefresh}
        onLoadMore={loadMoreFiles}
        hasMoreFiles={hasMoreFiles}
        selectable={true}
        selectedFiles={selectedFiles}
        onSelectFile={handleFileSelect}
      />
      
      {showActions && (
        <div className="flex space-x-2 animate-fadeIn">
          <Button 
            className="flex-1" 
            onClick={handleSendEmail}
            disabled={selectedFiles.length === 0}
          >
            Enviar por Email ({selectedFiles.length})
          </Button>
          <Button 
            className="flex-1" 
            onClick={handleSendWhatsApp}
            disabled={selectedFiles.length === 0}
          >
            Enviar por WhatsApp ({selectedFiles.length})
          </Button>
        </div>
      )}
    </div>
  );
}
