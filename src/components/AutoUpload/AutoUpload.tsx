
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
    isLoading
  } = useAutoUpload({ selectedClient, documentType });

  return (
    <Card className="p-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Upload Automático</h3>
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
          Atualizar Lista
        </Button>
      </div>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Para testar o upload manual de um arquivo para a pasta monitorada:
        </p>
        
        <UploadArea 
          isLoading={isLoading} 
          onFileSelect={handleUploadTest} 
        />
        
        <FilesList 
          files={uploadedFiles}
          isLoading={isLoadingFiles}
          onDelete={handleDeleteFile}
        />
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium mb-2">Monitoramento Automático de Pasta</h4>
          <p className="text-sm text-gray-600">
            Para configurar o monitoramento automático de uma pasta no seu computador, 
            você pode usar o script Python fornecido. Os arquivos colocados na pasta 
            monitorada serão automaticamente enviados para este sistema.
          </p>
        </div>
      </div>
    </Card>
  );
}
