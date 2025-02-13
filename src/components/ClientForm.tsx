
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Client } from "@/types/client";
import { supabase } from "@/integrations/supabase/client";

export default function ClientForm({ onSave }: { onSave: (client: Client) => void }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    whatsapp: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: formData.name,
          email: formData.email,
          whatsapp: formData.whatsapp,
        })
        .select()
        .single();

      if (error) throw error;

      const newClient: Client = {
        id: data.id,
        ...formData,
        createdAt: new Date(data.created_at),
      };

      onSave(newClient);
      toast({
        title: "Sucesso",
        description: "Cliente cadastrado com sucesso",
      });
      setFormData({ name: "", email: "", whatsapp: "" });
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: "Erro",
        description: "Erro ao cadastrar cliente",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fadeIn">
      <div className="space-y-2">
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full"
          placeholder="Digite o nome do cliente"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full"
          placeholder="Digite o email do cliente"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp</Label>
        <Input
          id="whatsapp"
          required
          value={formData.whatsapp}
          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
          className="w-full"
          placeholder="Digite o número do WhatsApp"
        />
      </div>
      <Button type="submit" className="w-full">
        Cadastrar Cliente
      </Button>
    </form>
  );
}
