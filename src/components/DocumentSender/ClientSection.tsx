
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientForm from "@/components/ClientForm";
import ClientList from "@/components/ClientList";
import { useClientData } from "@/hooks/useClientData";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";

export function ClientSection() {
  const { handleClientSave } = useClientData();
  const { clients, setSelectedClient } = useDocumentSender();

  return (
    <Card className="p-6">
      <Tabs defaultValue="register" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="register">Cadastrar Cliente</TabsTrigger>
          <TabsTrigger value="select">Selecionar Cliente</TabsTrigger>
        </TabsList>
        <TabsContent value="register">
          <ClientForm onSave={handleClientSave} />
        </TabsContent>
        <TabsContent value="select">
          <ClientList clients={clients} onSelect={setSelectedClient} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
