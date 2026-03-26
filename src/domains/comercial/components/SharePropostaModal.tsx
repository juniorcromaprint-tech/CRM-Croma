// src/domains/comercial/components/SharePropostaModal.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, MessageCircle, Mail, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useEmpresaPrincipal } from "@/shared/hooks/useEmpresaPrincipal";

interface Props {
  open: boolean;
  onClose: () => void;
  propostaId: string;
  propostaNumero: string;
  shareToken: string;
  clienteTelefone?: string;
  clienteEmail?: string;
}

export function SharePropostaModal({ open, onClose, propostaId, propostaNumero, shareToken, clienteTelefone, clienteEmail }: Props) {
  const { data: empresa } = useEmpresaPrincipal();
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || 'Croma Print';
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(clienteEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const portalUrl = `${window.location.origin}/p/${shareToken}`;

  const activateToken = async () => {
    await supabase.from('propostas').update({
      share_token_active: true,
      share_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'enviada',
    } as any).eq('id', propostaId);
  };

  const activateAndCopy = async () => {
    await activateToken();
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    showSuccess('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = async () => {
    await activateToken();
    const msg = encodeURIComponent(
      `Olá! Segue o link da proposta ${propostaNumero} da ${nomeEmpresa}:\n\n${portalUrl}\n\nQualquer dúvida estou à disposição!`
    );
    const phone = (clienteTelefone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const sendEmail = async () => {
    if (!emailTo) return;
    setSendingEmail(true);
    try {
      await activateToken();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Sessão expirada. Faça login novamente.');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enviar-email-proposta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ proposta_id: propostaId, destinatario_email: emailTo }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao enviar email');
      }
      showSuccess('Email enviado!');
      setShowEmailForm(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Erro ao enviar email');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={activateAndCopy}>
            {copied ? <Check size={18} className="text-green-500" /> : <Link2 size={18} />}
            {copied ? 'Link copiado!' : 'Copiar Link'}
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={openWhatsApp}>
            <MessageCircle size={18} className="text-green-600" />
            Enviar por WhatsApp
          </Button>
          {!showEmailForm ? (
            <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => setShowEmailForm(true)}>
              <Mail size={18} className="text-blue-600" />
              Enviar por Email
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="email@cliente.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                className="rounded-xl"
              />
              <Button onClick={sendEmail} disabled={sendingEmail || !emailTo} className="bg-blue-600 hover:bg-blue-700">
                {sendingEmail ? <Loader2 className="animate-spin" size={16} /> : 'Enviar'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
