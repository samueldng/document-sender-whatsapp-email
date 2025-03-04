
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
      console.log("Verificando existência do bucket 'documents'");
      
      // Create bucket via edge function
      const response = await supabase.functions.invoke('create-bucket', {
        body: { bucketName: 'documents' }
      });
      
      if (!response.data?.success) {
        console.error("Erro ao criar bucket:", response.error || response.data);
        throw new Error(`Falha ao criar bucket: ${response.error?.message || 'resposta inválida'}`);
      }
      
      console.log("Bucket 'documents' está pronto para uso");
      return true;
    } catch (error) {
      console.error("Erro ao verificar/criar bucket:", error);
      toast({
        title: "Erro",
        description: `Falha ao verificar/criar bucket: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  // Load all uploaded files
  const loadUploadedFiles = async () => {
    setIsLoadingFiles(true);
    
    try {
      console.log("Carregando arquivos...");
      
      // Make sure bucket exists before trying to list files
      const bucketReady = await checkAndCreateBucket();
      if (!bucketReady) {
        console.error("Bucket not ready, cannot load files");
        return;
      }
      
      // Get all documents of the specified type
      const query = supabase
        .from('documents')
        .select('*')
        .eq('document_type', documentType)
        .order('created_at', { ascending: false });
      
      if (selectedClient) {
        query.eq('client_id', selectedClient.id);
      }
      
      const { data: dbDocs, error: dbError } = await query;
      
      if (dbError) {
        console.error("Erro ao consultar tabela documents:", dbError);
        throw new Error(`Falha ao consultar documentos: ${dbError.message}`);
      }
      
      console.log(`Encontrados ${dbDocs?.length || 0} documentos na tabela`);
      
      if (!dbDocs || dbDocs.length === 0) {
        setUploadedFiles([]);
        return;
      }
      
      // Map database documents to files with URLs
      const filesWithUrls = await Promise.all(dbDocs.map(async (doc) => {
        // Get public URL
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
          
        return {
          name: doc.filename, // Use the original filename from DB
          path: doc.file_path,
          url: doc.url || urlData.publicUrl,
          created_at: doc.created_at
        };
      }));
      
      // Sort files by creation date (newest first)
      filesWithUrls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setUploadedFiles(filesWithUrls);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      toast({
        title: "Erro",
        description: `Falha ao carregar os arquivos enviados: ${error.message}`,
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
      const bucketReady = await checkAndCreateBucket();
      if (!bucketReady) {
        throw new Error("Não foi possível criar ou verificar o bucket");
      }
      
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
        description: `Falha ao enviar arquivo: ${error.message}`,
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
