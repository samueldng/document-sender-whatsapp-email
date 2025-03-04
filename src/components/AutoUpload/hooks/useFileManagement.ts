
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Client, DocumentType } from "@/types/client";
import { UploadedFile } from "../FilesList";
import { useBucketManagement } from "./useBucketManagement";

export function useFileManagement({ selectedClient, documentType }: { 
  selectedClient: Client | null;
  documentType: DocumentType;
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const { checkAndCreateBucket } = useBucketManagement();

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
        // Get public URL - the document doesn't have a URL property, so we need to get it
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
          
        return {
          name: doc.filename, // Use the original filename from DB
          path: doc.file_path,
          url: urlData.publicUrl, // Use the publicUrl from getPublicUrl instead of doc.url
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

  return {
    isLoadingFiles,
    uploadedFiles,
    loadUploadedFiles,
    handleDeleteFile,
  };
}
