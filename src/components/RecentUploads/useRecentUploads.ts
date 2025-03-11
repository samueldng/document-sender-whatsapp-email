
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = "https://ddmandptdqdigxsbbfcj.supabase.co";

export interface RecentUpload {
  id: string;
  filename: string;
  created_at: string;
  document_type: string;
  file_path: string;
  url: string;
}

export function useRecentUploads(maxItems: number = 5) {
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadRecentUploads = async () => {
    setIsLoading(true);
    try {
      console.log("[useRecentUploads] Carregando uploads recentes...");
      
      // Fetch documents sorted by creation date in descending order
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (error) {
        console.error("[useRecentUploads] Erro ao buscar documentos:", error);
        setError("Não foi possível carregar os uploads recentes");
        return;
      }

      console.log("[useRecentUploads] Documentos obtidos:", data);

      if (!data || data.length === 0) {
        console.log("[useRecentUploads] Nenhum documento encontrado");
        setRecentUploads([]);
        setError(null);
        return;
      }

      // Get public URLs for each document
      const uploadsWithUrls = await Promise.all(data.map(async (doc) => {
        const { data: urlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path);
          
        return {
          ...doc,
          url: urlData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/documents/${doc.file_path}`
        } as RecentUpload;
      }));
      
      console.log("[useRecentUploads] Documentos com URLs:", uploadsWithUrls);
      setRecentUploads(uploadsWithUrls);
      setError(null);
    } catch (err) {
      console.error("[useRecentUploads] Erro inesperado:", err);
      setError("Ocorreu um erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadRecentUploads();
    
    console.log("[useRecentUploads] Configurando canal realtime...");
    
    // Set up realtime subscription for the documents table
    const channel = supabase
      .channel('documents-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'documents'
        }, 
        (payload) => {
          console.log('[useRecentUploads] Mudança detectada:', payload);
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Novo documento",
              description: "Um novo documento foi adicionado",
            });
          }
          
          // Reload the data when changes are detected
          loadRecentUploads();
        }
      )
      .subscribe((status) => {
        console.log('[useRecentUploads] Status do canal:', status);
        if (status === 'SUBSCRIBED') {
          console.log('[useRecentUploads] Inscrição realtime ativa');
        }
      });

    // Clean up on unmount
    return () => {
      console.log('[useRecentUploads] Limpando canal realtime');
      supabase.removeChannel(channel);
    };
  }, [maxItems, toast]);

  return {
    recentUploads,
    isLoading,
    error,
    loadRecentUploads
  };
}
