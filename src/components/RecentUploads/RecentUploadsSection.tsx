
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileIcon, ExternalLinkIcon, LoaderIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecentUpload {
  id: string;
  filename: string;
  created_at: string;
  document_type: string;
  file_path: string;
  url: string;
}

interface RecentUploadsSectionProps {
  className?: string;
  maxItems?: number;
}

export function RecentUploadsSection({ 
  className = "", 
  maxItems = 5 
}: RecentUploadsSectionProps) {
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecentUploads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxItems);

      if (error) {
        console.error("Erro ao carregar uploads recentes:", error);
        setError("Não foi possível carregar os uploads recentes");
      } else {
        setRecentUploads(data as RecentUpload[]);
        setError(null);
      }
    } catch (err) {
      console.error("Erro inesperado:", err);
      setError("Ocorreu um erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  // Carrega uploads recentes ao montar o componente
  useEffect(() => {
    loadRecentUploads();
    
    // Configura um canal realtime para atualizar quando novos documentos forem adicionados
    const channel = supabase
      .channel('public:documents')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'documents' 
        }, 
        () => {
          // Recarrega os uploads quando houver qualquer mudança na tabela documents
          loadRecentUploads();
        }
      )
      .subscribe();
    
    // Limpa o canal ao desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [maxItems]);

  // Formata o tipo de documento para exibição
  const formatDocumentType = (type: string) => {
    const types: Record<string, string> = {
      'invoice': 'Fatura',
      'contract': 'Contrato',
      'receipt': 'Recibo',
      'report': 'Relatório',
      'other': 'Outro'
    };
    return types[type] || type;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Uploads Recentes</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadRecentUploads}
            disabled={isLoading}
          >
            <LoaderIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && recentUploads.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : recentUploads.length === 0 ? (
          <div className="text-center py-4 text-gray-500">Nenhum upload recente encontrado</div>
        ) : (
          <div className="space-y-3">
            {recentUploads.map((upload) => (
              <div 
                key={upload.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <FileIcon className="h-5 w-5 flex-shrink-0 text-blue-500" />
                  <div className="overflow-hidden">
                    <p className="font-medium text-sm truncate">{upload.filename}</p>
                    <div className="flex text-xs text-gray-500 space-x-2">
                      <span>{formatDocumentType(upload.document_type)}</span>
                      <span>•</span>
                      <span title={new Date(upload.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(upload.created_at), { 
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => window.open(upload.url, '_blank')}
                  title="Abrir arquivo"
                >
                  <ExternalLinkIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
