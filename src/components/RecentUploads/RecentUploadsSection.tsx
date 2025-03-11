
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoaderIcon } from "lucide-react";
import { useRecentUploads } from "./useRecentUploads";
import { UploadItem } from "./UploadItem";
import { EmptyState } from "./EmptyState";

interface RecentUploadsSectionProps {
  className?: string;
  maxItems?: number;
}

export function RecentUploadsSection({ 
  className = "", 
  maxItems = 5 
}: RecentUploadsSectionProps) {
  const { recentUploads, isLoading, error, loadRecentUploads } = useRecentUploads(maxItems);

  const formatDocumentType = (type: string) => {
    const types: Record<string, string> = {
      'invoice': 'Fatura',
      'contract': 'Contrato',
      'receipt': 'Recibo',
      'report': 'Relatório',
      'tax': 'Imposto',
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
            onClick={() => loadRecentUploads()}
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
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {recentUploads.map((upload) => (
              <UploadItem 
                key={upload.id} 
                upload={upload} 
                formatDocumentType={formatDocumentType} 
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
