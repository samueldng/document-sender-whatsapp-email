
import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Client, DocumentType } from "@/types/client";
import { UploadedFile } from "../FilesList";
import { useBucketManagement } from "./useBucketManagement";

// Default pagination settings
const ITEMS_PER_PAGE = 10;

export function useFileManagement({ selectedClient, documentType }: { 
  selectedClient: Client | null;
  documentType: DocumentType;
}) {
  const { toast } = useToast();
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const cachedFilesRef = useRef<{[key: string]: UploadedFile[]}>({});
  const { checkAndCreateBucket } = useBucketManagement();

  // Generate a cache key based on client and document type
  const getCacheKey = useCallback(() => {
    return `${selectedClient?.id || 'all'}_${documentType}`;
  }, [selectedClient, documentType]);

  // Reset pagination when client or document type changes
  const resetPagination = useCallback(() => {
    setCurrentPage(0);
    setHasMoreFiles(true);
    setUploadedFiles([]);
    // Clear the specific cache for this client/document type
    const cacheKey = getCacheKey();
    if (cachedFilesRef.current[cacheKey]) {
      delete cachedFilesRef.current[cacheKey];
    }
  }, [getCacheKey]);

  // Load files with pagination
  const loadUploadedFiles = useCallback(async (forceRefresh = false) => {
    setIsLoadingFiles(true);
    
    try {
      console.log("Loading files with pagination...");
      const cacheKey = getCacheKey();
      
      // If forcing refresh, clear the cache for this view
      if (forceRefresh && cachedFilesRef.current[cacheKey]) {
        delete cachedFilesRef.current[cacheKey];
        setCurrentPage(0);
        setUploadedFiles([]);
        setHasMoreFiles(true);
      }
      
      // If we have cached files and it's not the first page load or a force refresh,
      // use the cache
      if (cachedFilesRef.current[cacheKey] && uploadedFiles.length > 0 && !forceRefresh) {
        console.log("Using cached files");
        return;
      }
      
      // Make sure bucket exists before trying to list files
      const bucketReady = await checkAndCreateBucket();
      if (!bucketReady) {
        console.error("Bucket not ready, cannot load files");
        return;
      }
      
      // Calculate offset for pagination
      const offset = currentPage * ITEMS_PER_PAGE;
      
      // Get documents of the specified type with pagination
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
      
      // If we got fewer items than the page size, there are no more files
      if (!dbDocs || dbDocs.length < ITEMS_PER_PAGE) {
        setHasMoreFiles(false);
      }
      
      if (!dbDocs || dbDocs.length === 0) {
        // If it's the first page, set empty array
        if (currentPage === 0) {
          setUploadedFiles([]);
        }
        return;
      }
      
      // Map database documents to files with URLs
      const filesWithUrls = await Promise.all(dbDocs.map(async (doc) => {
        // Get public URL
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
          
        return {
          name: doc.filename,
          path: doc.file_path,
          url: urlData.publicUrl,
          created_at: doc.created_at
        };
      }));
      
      // Update the files state - append new files if paginating
      setUploadedFiles(prevFiles => 
        currentPage === 0 ? filesWithUrls : [...prevFiles, ...filesWithUrls]
      );
      
      // Update the cache
      cachedFilesRef.current[cacheKey] = 
        currentPage === 0 ? filesWithUrls : [...(cachedFilesRef.current[cacheKey] || []), ...filesWithUrls];
      
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "Error",
        description: `Failed to load uploaded files: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  }, [checkAndCreateBucket, currentPage, documentType, getCacheKey, selectedClient, toast, uploadedFiles.length]);

  // Load more files (pagination)
  const loadMoreFiles = useCallback(() => {
    if (isLoadingFiles || !hasMoreFiles) return;
    
    setCurrentPage(prev => prev + 1);
  }, [hasMoreFiles, isLoadingFiles]);

  // Handle file deletion with cache update
  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      // Delete file from storage bucket
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);
        
      if (storageError) {
        console.error("Error deleting file from storage:", storageError);
        throw storageError;
      }
      
      // Delete record from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', filePath);
        
      if (dbError) {
        console.error("Error deleting record from database:", dbError);
        throw dbError;
      }
      
      // Update files list
      const updatedFiles = uploadedFiles.filter(file => file.path !== filePath);
      setUploadedFiles(updatedFiles);
      
      // Update cache for all relevant cache keys
      Object.keys(cachedFilesRef.current).forEach(key => {
        cachedFilesRef.current[key] = cachedFilesRef.current[key].filter(
          file => file.path !== filePath
        );
      });
      
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Failed to delete the file",
        variant: "destructive",
      });
    }
  }, [toast, uploadedFiles]);

  return {
    isLoadingFiles,
    uploadedFiles,
    hasMoreFiles,
    loadUploadedFiles,
    loadMoreFiles,
    handleDeleteFile,
    resetPagination,
  };
}
