
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Client, DocumentType } from "@/types/client";
import { supabase } from "@/integrations/supabase/client";
import { UploadedFile } from "./FilesList";

interface UseAutoUploadProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function useAutoUpload({ selectedClient, documentType }: UseAutoUploadProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Verify and create bucket if necessary
  const checkAndCreateBucket = async () => {
    try {
      // Check if 'documents' bucket exists
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
        // Create bucket via edge function
        const response = await supabase.functions.invoke('create-bucket', {
          body: { bucketName: 'documents' }
        });
        
        if (response.error) {
          console.error("Erro ao criar bucket:", response.error);
          return;
        }
        
        console.log("Bucket 'documents' criado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
    }
  };

  // Load all uploaded files
  const loadUploadedFiles = async () => {
    setIsLoadingFiles(true);
    
    try {
      console.log("Carregando arquivos...");
      
      // Get all documents of the specified type
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
      
      // Make sure bucket exists before trying to list files
      await checkAndCreateBucket();
      
      // Check for files in the bucket with the specified document type
      const rootFolder = documentType === "invoice" ? "invoice" : "tax";
      
      // List all files in the root folder of the document type
      const { data: rootFiles, error: rootError } = await supabase.storage
        .from('documents')
        .list(rootFolder, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        
      if (rootError) {
        console.error("Erro ao buscar arquivos na pasta raiz:", rootError);
        // Continue despite errors
      }
      
      // For each client, list their files of the specified type
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id');
        
      if (clientsError) {
        console.error("Erro ao buscar clientes:", clientsError);
        // Continue despite errors
      }
      
      let allStorageFiles: any[] = rootFiles || [];
      
      // Get files for all clients
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
              // Add client info to each file
              const clientEnrichedFiles = clientFiles.map(file => ({
                ...file,
                clientId: client.id,
                clientFolder: clientFolder.split('/')[0]
              }));
              allStorageFiles = [...allStorageFiles, ...clientEnrichedFiles];
            }
          } catch (e) {
            console.error(`Erro ao buscar arquivos do cliente ${client.id}:`, e);
            // Continue to the next client
          }
        }
      }
      
      // Remove directories (items with metadata)
      const relevantFiles = allStorageFiles.filter(file => !file.metadata);
      
      console.log(`Encontrados ${relevantFiles.length} arquivos relevantes no storage`);
      
      // Map storage files for display and index them if needed
      const filesWithUrls = await Promise.all(relevantFiles.map(async (file) => {
        // Determine file path
        const folderPrefix = file.clientFolder || rootFolder;
        const filePath = `${folderPrefix}/${file.name}`;
        
        // Check if this file is already in the documents table
        const existingDoc = dbDocs?.find(doc => doc.file_path === filePath);
        
        // Get public URL
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
          
        // If file is not indexed in documents table, index it
        if (!existingDoc) {
          console.log(`Indexando arquivo ${file.name} na tabela documents`);
          
          const { error: insertError } = await supabase
            .from('documents')
            .insert({
              client_id: file.clientId || null,
              document_type: documentType,
              file_path: filePath,
              filename: file.name // Preserve original filename
            });
            
          if (insertError) {
            console.error(`Erro ao indexar arquivo ${file.name}:`, insertError);
          }
        }
        
        return {
          name: existingDoc?.filename || file.name, // Use filename from DB or original name
          path: filePath,
          url: urlData.publicUrl,
          created_at: file.created_at || existingDoc?.created_at || new Date().toISOString()
        };
      }));
      
      // Sort files by creation date (newest first)
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

  // Handle file upload
  const handleUploadTest = async (files: FileList) => {
    setIsLoading(true);
    
    try {
      // Make sure bucket exists before attempting upload
      await checkAndCreateBucket();
      
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
          formData.append('originalFilename', file.name); // Add original filename

          // Call edge function for upload
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
      
      // Final summary
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
      // Reload files list after upload
      loadUploadedFiles();
    }
  };

  // Handle file deletion
  const handleDeleteFile = async (filePath: string) => {
    try {
      // Delete file from storage bucket
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
        
      if (storageError) {
        console.error("Erro ao excluir arquivo do storage:", storageError);
        throw storageError;
      }
      
      // Delete record from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath);
        
      if (dbError) {
        console.error("Erro ao excluir registro do banco:", dbError);
        throw dbError;
      }
      
      // Update files list
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

  // Force refresh of files list
  const handleForceRefresh = () => {
    loadUploadedFiles();
    toast({
      title: "Atualizando",
      description: "Atualizando lista de arquivos...",
    });
  };

  // Set up automatic refresh and initial load
  useEffect(() => {
    checkAndCreateBucket();
    loadUploadedFiles();
    
    // Set up interval to refresh files periodically
    const intervalId = setInterval(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [selectedClient, documentType, refreshTrigger]);

  return {
    isLoading,
    isLoadingFiles,
    uploadedFiles,
    handleUploadTest,
    handleDeleteFile,
    handleForceRefresh,
  };
}
