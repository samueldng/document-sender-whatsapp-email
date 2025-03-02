import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { UploadIcon, FolderIcon, FileIcon, ExternalLinkIcon, Trash2Icon, LoaderIcon } from "lucide-react";
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Carregar arquivos quando o componente for montado ou quando mudar o cliente/tipo de documento
  useEffect(() => {
    checkAndCreateBucket();
    loadUploadedFiles();
    
    // Configurar um intervalo para atualizar os arquivos periodicamente
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000); // Atualiza a cada 30 segundos
    
    return () => clearInterval(intervalId);
  }, [selectedClient, documentType, refreshTrigger]);

  // Verifica se o bucket existe e cria se necessário
  const checkAndCreateBucket = async () => {
    try {
      // Verificar se o bucket 'documents' existe
      const { data: buckets, error: bucketsError } = await supabase
        .storage
        .listBuckets();
        
      if (bucketsError) {
        console.error("Erro ao verificar buckets:", bucketsError);
        return;
      }
      
      const documentsBucketExists = buckets?.some(bucket => bucket.name === 'documents');
      
      if (!documentsBucketExists) {
        console.log("Bucket 'documents' não encontrado, criando...");
        // O bucket não existe, então vamos criá-lo via função edge
        await supabase.functions.invoke('create-bucket', {
          body: { bucketName: 'documents' }
        });
        
        console.log("Bucket 'documents' criado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
    }
  };

  const loadUploadedFiles = async () => {
    setIsLoadingFiles(true);
    
    try {
      console.log("Carregando arquivos...");
      
      // Buscar todos os documentos do tipo especificado, independente do cliente
      const query = supabase
        .from('documents')
        .select('*')
        .eq('document_type', documentType)
        .order('created_at', { ascending: false });
      
      const { data: dbDocs, error: dbError } = await query;
      
      if (dbError) {
        console.error("Erro ao consultar tabela documents:", dbError);
        throw dbError;
      }
      
      console.log(`Encontrados ${dbDocs?.length || 0} documentos na tabela`);
      
      // Verificar se há arquivos no bucket do tipo de documento especificado
      const rootFolder = documentType === "invoice" ? "invoice" : "tax";
      
      // Listar todos os arquivos na pasta raiz do tipo de documento
      const { data: rootFiles, error: rootError } = await supabase.storage
        .from('documents')
        .list(rootFolder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (rootError) {
        console.error("Erro ao buscar arquivos na pasta raiz:", rootError);
        // Continuar mesmo com erro, pois podemos ter arquivos em pastas de clientes
      }
      
      // Para cada cliente, listar seus arquivos do tipo especificado
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id');
        
      if (clientsError) {
        console.error("Erro ao buscar clientes:", clientsError);
        // Continuar mesmo com erro
      }
      
      let allStorageFiles: any[] = rootFiles || [];
      
      // Buscar arquivos de todos os clientes
      if (clients && clients.length > 0) {
        for (const client of clients) {
          const clientFolder = `client_${client.id}/${documentType}`;
          try {
            const { data: clientFiles, error: clientFilesError } = await supabase.storage
              .from('documents')
              .list(clientFolder.split('/')[0], {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
              });
              
            if (!clientFilesError && clientFiles && clientFiles.length > 0) {
              // Adicionar informação do cliente a cada arquivo
              const clientEnrichedFiles = clientFiles.map(file => ({
                ...file,
                clientId: client.id,
                clientFolder: clientFolder.split('/')[0]
              }));
              allStorageFiles = [...allStorageFiles, ...clientEnrichedFiles];
            }
          } catch (e) {
            console.error(`Erro ao buscar arquivos do cliente ${client.id}:`, e);
            // Continuar para o próximo cliente
          }
        }
      }
      
      // Remover diretórios (itens com metadata)
      const relevantFiles = allStorageFiles.filter(file => !file.metadata);
      
      console.log(`Encontrados ${relevantFiles.length} arquivos relevantes no storage`);
      
      // Mapear os arquivos do storage para exibição e indexá-los se necessário
      const filesWithUrls = await Promise.all(relevantFiles.map(async (file) => {
        // Determinar o caminho do arquivo
        const folderPrefix = file.clientFolder || rootFolder;
        const filePath = `${folderPrefix}/${file.name}`;
        
        // Verificar se este arquivo já está na tabela documents
        const existingDoc = dbDocs?.find(doc => doc.file_path === filePath);
        
        // Obter URL pública
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
          
        // Se o arquivo ainda não estiver indexado na tabela documents, vamos indexá-lo
        if (!existingDoc) {
          console.log(`Indexando arquivo ${file.name} na tabela documents`);
          
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              client_id: file.clientId || null,
              document_type: documentType,
              file_path: filePath,
              filename: file.name // Preservar o nome original do arquivo
            });
            
          if (insertError) {
            console.error(`Erro ao indexar arquivo ${file.name}:`, insertError);
          }
        }
        
        return {
          name: existingDoc?.filename || file.name, // Use the filename from DB or original name
          path: filePath,
          url: urlData.publicUrl,
          created_at: file.created_at || existingDoc?.created_at || new Date().toISOString()
        };
      }));
      
      // Ordenar arquivos por data de criação (mais recentes primeiro)
      filesWithUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setUploadedFiles(filesWithUrls);
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
      let successCount = 0;
      let errorCount = 0;
      
      for (const file of Array.from(files)) {
        try {
          console.log(`Preparando upload para: ${file.name}`);
          
          const formData = new FormData();
          formData.append('file', file);
          
          if (selectedClient) {
            formData.append('clientId', selectedClient.id);
          }
          
          formData.append('documentType', documentType);
          formData.append('originalFilename', file.name); // Adicionar nome original do arquivo

          // Chamar a edge function para upload
          console.log("Enviando arquivo para a edge function upload-auto");
          const response = await supabase.functions.invoke('upload-auto', {
            body: formData,
          });

          if (response.error) {
            console.error("Erro na resposta da função:", response.error);
            throw new Error(response.error.message);
          }

          console.log("Resposta da função:", response.data);
          successCount++;
          
          toast({
            title: "Sucesso",
            description: `Arquivo ${file.name} enviado com sucesso`,
          });
        } catch (fileError) {
          console.error(`Erro ao processar arquivo ${file.name}:`, fileError);
          errorCount++;
        }
      }
      
      // Resumo final
      if (successCount > 0 && errorCount > 0) {
        toast({
          title: "Upload Parcial",
          description: `${successCount} arquivo(s) enviado(s) com sucesso, ${errorCount} falha(s)`,
          variant: "default",
        });
      } else if (successCount > 0) {
        toast({
          title: "Sucesso",
          description: `${successCount} arquivo(s) enviado(s) com sucesso`,
        });
      } else if (errorCount > 0) {
        toast({
          title: "Erro",
          description: `Falha ao enviar ${errorCount} arquivo(s)`,
          variant: "destructive",
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
        console.error("Erro ao excluir arquivo do storage:", storageError);
        throw storageError;
      }
      
      // Excluir o registro do banco de dados
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath);
        
      if (dbError) {
        console.error("Erro ao excluir registro do banco:", dbError);
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

  const handleForceRefresh = () => {
    loadUploadedFiles();
    toast({
      title: "Atualizando",
      description: "Atualizando lista de arquivos...",
    });
  };

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
            {isLoading ? (
              <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UploadIcon className="h-4 w-4 mr-2" />
            )}
            {isLoading ? "Enviando..." : "Selecionar Arquivos"}
          </Button>
        </div>
        
        {/* Lista de arquivos enviados */}
        <div className="mt-6">
          <h4 className="text-md font-medium mb-3">Arquivos Enviados</h4>
          
          {isLoadingFiles ? (
            <div className="text-center py-4">
              <LoaderIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
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
