
import { FolderIcon, LoaderIcon, UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UploadAreaProps {
  isLoading: boolean;
  handleUpload: (files: FileList) => void;
  disabled?: boolean;
}

export default function UploadArea({ isLoading, handleUpload, disabled = false }: UploadAreaProps) {
  return (
    <div className="relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center">
      <FolderIcon className="h-12 w-12 text-gray-400 mb-2" />
      <p className="text-sm text-center text-gray-500 mb-2">
        Arraste arquivos aqui ou clique para selecionar
      </p>
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        multiple
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        disabled={isLoading || disabled}
      />
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-2"
        disabled={isLoading || disabled}
      >
        {isLoading ? (
          <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <UploadIcon className="h-4 w-4 mr-2" />
        )}
        {isLoading ? "Enviando..." : "Selecionar Arquivos"}
      </Button>
    </div>
  );
}
