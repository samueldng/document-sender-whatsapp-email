
import { FileIcon } from "lucide-react";

export function EmptyState() {
  return (
    <div className="text-center py-8">
      <FileIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
      <p className="text-gray-500">Nenhum upload recente encontrado</p>
    </div>
  );
}
