
import { useState } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Client, DocumentType } from "@/types/client";
import UploadArea from "./UploadArea";
import FilesList from "./FilesList";
import { useAutoUpload } from "./useAutoUpload";
import { useSendDocument } from "@/hooks/useDocumentSender";
import { Button } from "../ui/button";
import { MailIcon, MessageSquare, RefreshCwIcon } from "lucide-react";

interface AutoUploadProps {
  selectedClient: Client;
  documentType: DocumentType;
}

export default function AutoUpload({ selectedClient, documentType }: AutoUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { handleSendUploadedFiles } = useSendDocument();
  
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
    bucketError
  } = useAutoUpload({
    selectedClient,
    documentType
  });

  const handleSelectFile = (path: string, isSelected: boolean) => {
    setSelectedFiles(prev => {
      if (isSelected) {
        return [...prev, path];
      } else {
        return prev.filter(p => p !== path);
      }
    });
  };

  const handleSendSelected = async (method: "email" | "whatsapp") => {
    if (selectedFiles.length === 0) return;
    
    const filesToSend = selectedFiles
      .map(path => getFileByPath(path))
      .filter(Boolean);
      
    await handleSendUploadedFiles(method, filesToSend);
    setSelectedFiles([]);
  };

  return (
    <div className="space-y-4">
      {bucketError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro de armazenamento</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <p>{bucketError}</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-fit" 
              onClick={handleForceRefresh}
            >
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      <UploadArea 
        handleUpload={handleUploadTest} 
        isLoading={isLoading} 
        disabled={!!bucketError} 
      />
      
      {selectedFiles.length > 0 && (
        <div className="my-4 p-4 bg-secondary rounded-lg">
          <p className="mb-2 font-medium">{selectedFiles.length} arquivo(s) selecionado(s)</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleSendSelected("email")}
            >
              <MailIcon className="mr-2 h-4 w-4" />
              Enviar por Email
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleSendSelected("whatsapp")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Enviar por WhatsApp
            </Button>
          </div>
        </div>
      )}
      
      <FilesList 
        files={uploadedFiles} 
        isLoading={isLoadingFiles} 
        onDelete={handleDeleteFile}
        hasMoreFiles={hasMoreFiles}
        onLoadMore={loadMoreFiles}
        selectable={true}
        selectedFiles={selectedFiles}
        onSelectFile={handleSelectFile}
      />
      
      <div className="text-center">
        <Button
          variant="outline"
          onClick={handleForceRefresh}
          size="sm"
          className="mt-2"
        >
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Atualizar Lista
        </Button>
      </div>
    </div>
  );
}
