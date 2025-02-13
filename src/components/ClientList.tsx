
import { Client } from "@/types/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserIcon } from "lucide-react";

export default function ClientList({
  clients,
  onSelect,
}: {
  clients: Client[];
  onSelect: (client: Client) => void;
}) {
  return (
    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
      <div className="space-y-2">
        {clients.map((client) => (
          <Button
            key={client.id}
            variant="ghost"
            className="w-full justify-start gap-2 hover:bg-secondary"
            onClick={() => onSelect(client)}
          >
            <UserIcon className="h-4 w-4" />
            <span className="truncate">{client.name}</span>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
