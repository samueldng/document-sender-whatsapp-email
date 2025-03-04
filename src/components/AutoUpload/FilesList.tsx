
import { ExternalLinkIcon, FileIcon, LoaderIcon, Trash2Icon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface UploadedFile {
  name: string;
  path: string;
  url: string;
  created_at: string;
}

interface FilesListProps {
  files: UploadedFile[];
  isLoading: boolean;
  onDelete: (path: string) => Promise<void>;
  hasMoreFiles?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  selectable?: boolean;
  selectedFiles?: string[];
  onSelectFile?: (path: string, isSelected: boolean) => void;
}

export default function FilesList({ 
  files, 
  isLoading, 
  onDelete, 
  hasMoreFiles = false,
  onLoadMore,
  isLoadingMore = false,
  selectable = false,
  selectedFiles = [],
  onSelectFile
}: FilesListProps) {
  return (
    <div className="mt-6">
      <h4 className="text-md font-medium mb-3">Uploaded Files</h4>
      
      {isLoading && files.length === 0 ? (
        <div className="text-center py-4">
          <LoaderIcon className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">Loading files...</p>
        </div>
      ) : files.length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {files.map((file, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  {selectable && onSelectFile && (
                    <Checkbox 
                      checked={selectedFiles.includes(file.path)}
                      onCheckedChange={(checked) => onSelectFile(file.path, !!checked)}
                      className="ml-1"
                    />
                  )}
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
                    title="Open file"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onDelete(file.path)}
                    title="Delete file"
                  >
                    <Trash2Icon className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {hasMoreFiles && onLoadMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full"
              >
                {isLoadingMore ? (
                  <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4 mr-2" />
                )}
                Load More
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-sm text-gray-500">No files uploaded yet</p>
        </div>
      )}
    </div>
  );
}
