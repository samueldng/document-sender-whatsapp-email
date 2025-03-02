
import { useEffect } from "react";
import { Client } from "@/types/client";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentSender } from "@/contexts/DocumentSenderContext";

export function useClientData() {
  const { toast } = useToast();
  const { setClients } = useDocumentSender();

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setClients(data.map(client => ({
        id: client.id,
        name: client.name,
        email: client.email,
        whatsapp: client.whatsapp,
        createdAt: new Date(client.created_at),
      })));
    } catch (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar clientes",
        variant: "destructive",
      });
    }
  };

  const handleClientSave = (client: Client) => {
    setClients(prev => [client, ...prev]);
  };

  useEffect(() => {
    loadClients();
  }, []);

  return { loadClients, handleClientSave };
}
