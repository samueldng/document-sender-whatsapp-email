
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecentUpload } from "./useRecentUploads";

interface UploadItemProps {
  upload: RecentUpload;
  formatDocumentType: (type: string) => string;
}

export function UploadItem({ upload, formatDocumentType }: UploadItemProps) {
  return (
    <div 
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
  );
}
