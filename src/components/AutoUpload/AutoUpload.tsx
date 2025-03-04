
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderIcon, UploadIcon, MailIcon, MessageSquare } from "lucide-react";
import { Client, DocumentType } from "@/types/client";
import UploadArea from "./UploadArea";
import FilesList from "./FilesList";
import { useAutoUpload } from "./useAutoUpload";
import { useSendDocument } from "@/hooks/useDocumentSender";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";
import { useToast } from "@/hooks/use-toast";

interface AutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function AutoUpload({ selectedClient, documentType }: AutoUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const { setIsLoading } = useDocumentSender();
  const { toast } = useToast();
  
  const { 
    isLoadingFiles, 
    uploadedFiles, 
    handleUploadTest, 
    handleDeleteFile,
    handleForceRefresh,
    loadMoreFiles,
    hasMoreFiles,
    isLoading
  } = useAutoUpload({ selectedClient, documentType });

  const { handleSendUploadedFiles } = useSendDocument();

  const handleSelectFile = (path: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedFiles(prev => [...prev, path]);
    } else {
      setSelectedFiles(prev => prev.filter(p => p !== path));
    }
  };

  const handleSendSelectedFiles = async (method: "email" | "whatsapp") => {
    if (selectedFiles.length === 0 || !selectedClient) {
      toast({
        title: "Erro",
        description: "Por favor, selecione pelo menos um arquivo",
        variant: "destructive",
      });
      return;
    }
    
    setIsSending(true);
    setIsLoading(true);
    
    try {
      // Find the selected files from uploadedFiles
      const filesToSend = uploadedFiles.filter(file => selectedFiles.includes(file.path));
      
      // Send the selected files using our new method
      await handleSendUploadedFiles(method, filesToSend);
      
      // Clear selection after sending
      setSelectedFiles([]);
    } catch (error) {
      console.error("Error sending files:", error);
    } finally {
      setIsSending(false);
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Automatic Upload</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleForceRefresh}
          disabled={isLoadingFiles}
        >
          {isLoadingFiles ? (
            <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <UploadIcon className="h-4 w-4 mr-2" />
          )}
          Refresh List
        </Button>
      </div>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          To test manual upload of a file to the monitored folder:
        </p>
        
        <UploadArea 
          isLoading={isLoading} 
          onFileSelect={handleUploadTest} 
        />
        
        <FilesList 
          files={uploadedFiles}
          isLoading={isLoadingFiles}
          onDelete={handleDeleteFile}
          hasMoreFiles={hasMoreFiles}
          onLoadMore={loadMoreFiles}
          isLoadingMore={isLoadingFiles && uploadedFiles.length > 0}
          selectable={true}
          selectedFiles={selectedFiles}
          onSelectFile={handleSelectFile}
        />
        
        {selectedFiles.length > 0 && (
          <div className="animate-fadeIn">
            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1"
                onClick={() => handleSendSelectedFiles("email")}
                disabled={isSending || selectedFiles.length === 0}
              >
                <MailIcon className="mr-2 h-4 w-4" />
                Enviar por Email
              </Button>
              <Button
                className="flex-1"
                onClick={() => handleSendSelectedFiles("whatsapp")}
                disabled={isSending || selectedFiles.length === 0}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Enviar por WhatsApp
              </Button>
            </div>
          </div>
        )}
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium mb-2">Automatic Folder Monitoring</h4>
          <p className="text-sm text-gray-600">
            To set up automatic folder monitoring on your computer, 
            you can use the provided Python script. Files placed in the
            monitored folder will be automatically uploaded to this system.
          </p>
        </div>
      </div>
    </Card>
  );
}
