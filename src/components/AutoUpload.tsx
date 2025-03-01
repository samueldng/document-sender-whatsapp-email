
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { UploadIcon, FolderIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

const AutoUpload = ({ selectedClient, documentType }: AutoUploadProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadTest = async (files: FileList) => {
    setIsLoading(true);
    
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        
        if (selectedClient) {
          formData.append('clientId', selectedClient.id);
        }
        
        formData.append('documentType', documentType);

        // Chamar a edge function para upload
        const response = await supabase.functions.invoke('upload-auto', {
          body: formData,
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        toast({
          title: "Sucesso",
          description: `Arquivo ${file.name} enviado com sucesso`,
        });
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">Upload Automático</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Para testar o upload manual de um arquivo para a pasta monitorada:
        </p>
        
        <div className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center">
          <FolderIcon className="h-12 w-12 text-gray-400 mb-2" />
          <p className="text-sm text-center text-gray-500 mb-2">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            multiple
            onChange={(e) => e.target.files && handleUploadTest(e.target.files)}
            disabled={isLoading}
          />
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            disabled={isLoading}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            Selecionar Arquivos
          </Button>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-md font-medium mb-2">Monitoramento Automático de Pasta</h4>
          <p className="text-sm text-gray-600">
            Para configurar o monitoramento automático de uma pasta no seu computador, 
            você precisará de um aplicativo desktop adicional. 
            Entre em contato para receber instruções de configuração.
          </p>
        </div>
      </div>
    </Card>
  );
};

export default AutoUpload;
