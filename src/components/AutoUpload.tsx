
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { UploadIcon, FolderIcon, FileIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  created_at: string;
}

const AutoUpload = ({ selectedClient, documentType }: AutoUploadProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Carregar arquivos quando o componente for montado ou quando mudar o cliente/tipo de documento
  useEffect(() => {
    loadUploadedFiles();
  }, [selectedClient, documentType]);

  const loadUploadedFiles = async () => {
    setIsLoadingFiles(true);
    
    try {
      // Buscar documentos da tabela documents
      const query = supabase
        .from('documents')
        .select('*')
        .eq('document_type', documentType);
      
      // Adicionar filtro de cliente se um cliente estiver selecionado
      if (selectedClient) {
        query.eq('client_id', selectedClient.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Obter URLs públicas para cada arquivo
      if (data) {
        const filesWithUrls = await Promise.all(data.map(async (file) => {
          const { data: urlData } = await supabase.storage
            .from('documents')
            .getPublicUrl(file.file_path);
            
          return {
            name: file.filename,
            path: file.file_path,
            url: urlData.publicUrl,
            created_at: file.created_at
          };
        }));
        
        setUploadedFiles(filesWithUrls);
      }
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar os arquivos enviados",
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  };

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
      // Recarregar a lista de arquivos após o upload
      loadUploadedFiles();
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      // Excluir o arquivo do bucket de armazenamento
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
        
      if (storageError) {
        throw storageError;
      }
      
      // Excluir o registro do banco de dados
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath);
        
      if (dbError) {
        throw dbError;
      }
      
      // Atualizar a lista de arquivos
      setUploadedFiles(uploadedFiles.filter(file => file.path !== filePath));
      
      toast({
        title: "Sucesso",
        description: "Arquivo excluído com sucesso",
      });
    } catch (error) {
      console.error('Erro ao excluir arquivo:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir o arquivo",
        variant: "destructive",
      });
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
        
        {/* Lista de arquivos enviados */}
        <div className="mt-6">
          <h4 className="text-md font-medium mb-3">Arquivos Enviados</h4>
          
          {isLoadingFiles ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">Carregando arquivos...</p>
            </div>
          ) : uploadedFiles.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {uploadedFiles.map((file, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />
                    <div className="truncate">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => window.open(file.url, '_blank')}
                      title="Abrir arquivo"
                    >
                      <ExternalLinkIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteFile(file.path)}
                      title="Excluir arquivo"
                    >
                      <Trash2Icon className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <p className="text-sm text-gray-500">Nenhum arquivo enviado ainda</p>
            </div>
          )}
        </div>
        
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
};

export default AutoUpload;
