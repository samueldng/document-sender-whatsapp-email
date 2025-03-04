
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoaderIcon, UploadIcon } from "lucide-react";
import { Client, DocumentType } from "@/types/client";
import UploadArea from "./UploadArea";
import FilesList from "./FilesList";
import { useAutoUpload } from "./useAutoUpload";

interface AutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function AutoUpload({ selectedClient, documentType }: AutoUploadProps) {
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
        />
        
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
