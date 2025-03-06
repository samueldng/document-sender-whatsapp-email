import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Client, DocumentType } from "@/types/client";
import { UploadedFile } from "../FilesList";
import { useBucketManagement } from "./useBucketManagement";

const ITEMS_PER_PAGE = 10;

interface UseFileManagementProps {
  selectedClient: Client | null;
  documentType: DocumentType;
}

export function useFileManagement({ selectedClient, documentType }: UseFileManagementProps) {
  const { toast } = useToast();
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const cachedFilesRef = useRef<{[key: string]: UploadedFile[]}>({});
  
  const { 
    checkAndCreateBucket, 
    checkBucketExists,
    isCheckingBucket 
  } = useBucketManagement();

  // Check bucket on component mount
  useEffect(() => {
    const initializeBucket = async () => {
      try {
        const bucketExists = await checkBucketExists();
        
        if (!bucketExists) {
          const success = await checkAndCreateBucket();
          if (!success) {
            setBucketError("Não foi possível preparar o armazenamento. Tente novamente mais tarde.");
          } else {
            setBucketError(null);
          }
        } else {
          setBucketError(null);
        }
      } catch (error) {
        console.error("Erro ao inicializar bucket:", error);
        setBucketError("Não foi possível verificar o armazenamento. Tente novamente mais tarde.");
      }
    };
    
    initializeBucket();
  }, [checkAndCreateBucket, checkBucketExists]);

  const getCacheKey = useCallback(() => {
    return `${selectedClient?.id || 'all'}_${documentType}`;
  }, [selectedClient, documentType]);

  const resetPagination = useCallback(() => {
    setCurrentPage(0);
    setHasMoreFiles(true);
    setUploadedFiles([]);
    const cacheKey = getCacheKey();
    if (cachedFilesRef.current[cacheKey]) {
      delete cachedFilesRef.current[cacheKey];
    }
  }, [getCacheKey]);

  const loadUploadedFiles = useCallback(async (forceRefresh = false) => {
    if (bucketError) {
      console.error("Cannot load files due to bucket error:", bucketError);
      return;
    }
    
    setIsLoadingFiles(true);
    
    try {
      console.log("Loading files with pagination...");
      const cacheKey = getCacheKey();
      
      if (forceRefresh && cachedFilesRef.current[cacheKey]) {
        delete cachedFilesRef.current[cacheKey];
        setCurrentPage(0);
        setUploadedFiles([]);
        setHasMoreFiles(true);
      }
      
      if (cachedFilesRef.current[cacheKey] && uploadedFiles.length > 0 && !forceRefresh) {
        console.log("Using cached files");
        setIsLoadingFiles(false);
        return;
      }
      
      // Check if bucket exists before proceeding
      const bucketExists = await checkBucketExists();
      
      if (!bucketExists) {
        const bucketReady = await checkAndCreateBucket();
        if (!bucketReady) {
          console.error("Bucket not ready, cannot load files");
          setBucketError("Não foi possível preparar o armazenamento. Tente novamente mais tarde.");
          setIsLoadingFiles(false);
          return;
        }
      }
      
      const offset = currentPage * ITEMS_PER_PAGE;
      
      const query = supabase
        .from('documents')
        .select('*')
        .eq('document_type', documentType)
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);
      
      if (selectedClient) {
        query.eq('client_id', selectedClient.id);
      }
      
      const { data: dbDocs, error: dbError } = await query;
      
      if (dbError) {
        console.error("Error querying documents table:", dbError);
        throw new Error(`Failed to query documents: ${dbError.message}`);
      }
      
      console.log(`Found ${dbDocs?.length || 0} documents on page ${currentPage}`);
      
      if (!dbDocs || dbDocs.length < ITEMS_PER_PAGE) {
        setHasMoreFiles(false);
      }
      
      if (!dbDocs || dbDocs.length === 0) {
        if (currentPage === 0) {
          setUploadedFiles([]);
        }
        setIsLoadingFiles(false);
        return;
      }
      
      const filesWithUrls = await Promise.all(dbDocs.map(async (doc) => {
        try {
          const { data: urlData } = await supabase.storage
            .from('documents')
            .getPublicUrl(doc.file_path);
            
          // The getPublicUrl method doesn't return an error property, so we check for urlData
          if (!urlData || !urlData.publicUrl) {
            throw new Error("Failed to get public URL");
          }
          
          return {
            name: doc.filename,
            path: doc.file_path,
            url: urlData.publicUrl,
            created_at: doc.created_at
          };
        } catch (error) {
          console.error(`Error getting URL for file ${doc.filename}:`, error);
          return {
            name: doc.filename,
            path: doc.file_path,
            url: '#error-loading-url',
            created_at: doc.created_at
          };
        }
      }));
      
      setUploadedFiles(prevFiles => 
        currentPage === 0 ? filesWithUrls : [...prevFiles, ...filesWithUrls]
      );
      
      cachedFilesRef.current[cacheKey] = 
        currentPage === 0 ? filesWithUrls : [...(cachedFilesRef.current[cacheKey] || []), ...filesWithUrls];
      
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Erro",
        description: `Falha ao carregar arquivos: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [checkAndCreateBucket, checkBucketExists, currentPage, documentType, getCacheKey, selectedClient, toast, uploadedFiles.length, bucketError]);

  const loadMoreFiles = useCallback(() => {
    if (isLoadingFiles || !hasMoreFiles) return;
    
    setCurrentPage(prev => prev + 1);
  }, [hasMoreFiles, isLoadingFiles]);

  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
        
      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        throw storageError;
      }
      
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath);
        
      if (dbError) {
        console.error("Error deleting record from database:", dbError);
        throw dbError;
      }
      
      const updatedFiles = uploadedFiles.filter(file => file.path !== filePath);
      setUploadedFiles(updatedFiles);
      
      Object.keys(cachedFilesRef.current).forEach(key => {
        cachedFilesRef.current[key] = cachedFilesRef.current[key].filter(
          file => file.path !== filePath
        );
      });
      
      toast({
        title: "Sucesso",
        description: "Arquivo deletado com sucesso",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Erro",
        description: "Falha ao deletar o arquivo",
        variant: "destructive",
      });
    }
  }, [toast, uploadedFiles]);

  const getFileByPath = useCallback((path: string) => {
    return uploadedFiles.find(file => file.path === path);
  }, [uploadedFiles]);

  return {
    isLoadingFiles,
    uploadedFiles,
    loadUploadedFiles,
    handleDeleteFile,
    loadMoreFiles,
    hasMoreFiles,
    resetPagination,
    getFileByPath,
    bucketError,
    setBucketError
  };
}
