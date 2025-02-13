
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentType } from "@/types/client";
import { Label } from "@/components/ui/label";
import { UploadIcon } from "lucide-react";

export default function DocumentUpload({
  documentType,
  onUpload,
}: {
  documentType: DocumentType;
  onUpload: (files: FileList) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={`mt-4 rounded-lg border-2 border-dashed p-8 text-center transition-all ${
        dragActive ? "border-primary bg-primary/5" : "border-gray-200"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <Label
        htmlFor="file-upload"
        className="flex cursor-pointer flex-col items-center gap-2"
      >
        <UploadIcon className="h-12 w-12 text-gray-400" />
        <span className="text-sm text-gray-600">
          Arraste e solte seus {documentType === "invoice" ? "notas fiscais" : "documentos fiscais"} aqui, ou
          clique para selecionar arquivos
        </span>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
        <Button type="button" variant="secondary" className="mt-2">
          Selecionar Arquivos
        </Button>
      </Label>
    </div>
  );
}
