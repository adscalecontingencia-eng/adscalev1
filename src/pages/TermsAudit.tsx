import React, { useEffect, useMemo, useState } from 'react';
import { PageHero } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileSignature, RefreshCw, Search, Download, Eye } from 'lucide-react';
import { resolveTermsText, downloadTextFile } from '@/lib/terms-archive';
import { toast } from 'sonner';

interface AcceptanceRow {
  id: string;
  client_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  terms_version: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface DownloadRow {
  id: string;
  created_at: string;
  client_id: string | null;
  auth_user_id: string | null;
  email: string | null;
  terms_version: string;
  action: string;
  format: string;
  language: string;
  ip_address: string | null;
  user_agent: string | null;
}

const fmtDate = (v: string) => new Date(v).toLocaleString('pt-BR');

export default function TermsAudit() {
  const [acceptances, setAcceptances] = useState<AcceptanceRow[]>([]);
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [version, setVersion] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<{ version: string; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [acc, dl, cli] = await Promise.all([
      supabase.from('client_terms_acceptances').select('*').order('accepted_at', { ascending: false }).limit(1000),
      supabase.from('terms_download_log').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('clients').select('id, name'),
    ]);
    setAcceptances((acc.data as any) || []);
    setDownloads((dl.data as any) || []);
    const map: Record<string, string> = {};
    ((cli.data as any[]) || []).forEach((c) => { map[c.id] = c.name; });
    setClients(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const versions = useMemo(() => {
    const s = new Set<string>();
    acceptances.forEach(r => s.add(r.terms_version));
    downloads.forEach(r => s.add(r.terms_version));
    return Array.from(s).sort();
  }, [acceptances, downloads]);

  const inRange = (iso: string) => {
    const d = iso.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  const matches = (r: { terms_version: string; email: string | null; client_id: string | null }) => {
    if (version !== 'all' && r.terms_version !== version) return false;
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const hay = [r.email, r.client_id ? clients[r.client_id] : null, r.terms_version].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(term);
  };

  const filteredAcceptances = useMemo(
    () => acceptances.filter(r => inRange(r.accepted_at) && matches(r)),
    [acceptances, q, version, from, to, clients]
  );
  const filteredDownloads = useMemo(
    () => downloads.filter(r => inRange(r.created_at) && matches(r)),
    [downloads, q, version, from, to, clients]
  );

  const openTerms = async (v: string, download = false) => {
    const res = await resolveTermsText(v, 'pt');
    if (!res.text) { toast.error('Texto desta versão não está arquivado no sistema.'); return; }
    if (download) downloadTextFile(`ad-scale-terms-${v}.txt`, res.text);
    else setPreview({ version: v, text: res.text });
  };

  const exportCsv = () => {
    const header = 'tipo,data,cliente,email,versao,acao,formato,idioma,ip';
    const lines = [
      ...filteredAcceptances.map(r => ['aceite', fmtDate(r.accepted_at), r.client_id ? clients[r.client_id] || '' : '', r.email || '', r.terms_version, 'accept', '', '', r.ip_address || ''].join(',')),
      ...filteredDownloads.map(r => ['download', fmtDate(r.created_at), r.client_id ? clients[r.client_id] || '' : '', r.email || '', r.terms_version, r.action, r.format, r.language, r.ip_address || ''].join(',')),
    ];
    downloadTextFile('termos-auditoria.csv', [header, ...lines].join('\n'));
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Auditoria de Termos de Uso"
        description="Histórico de aceitações e de downloads/visualizações dos Termos por cliente, versão e data."
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por cliente, e-mail ou versão..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Versão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as versões</SelectItem>
              {versions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-[160px]" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" className="w-[160px]" value={to} onChange={e => setTo(e.target.value)} />
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </Card>

      <Tabs defaultValue="acceptances">
        <TabsList>
          <TabsTrigger value="acceptances">Aceitações ({filteredAcceptances.length})</TabsTrigger>
          <TabsTrigger value="downloads">Downloads ({filteredDownloads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="acceptances">
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Versão</th>
                  <th className="text-left p-3">IP</th>
                  <th className="text-right p-3">Termo</th>
                </tr>
              </thead>
              <tbody>
                {filteredAcceptances.map(r => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="p-3 whitespace-nowrap">{fmtDate(r.accepted_at)}</td>
                    <td className="p-3">{r.client_id ? clients[r.client_id] || '—' : '—'}</td>
                    <td className="p-3">{r.email || '—'}</td>
                    <td className="p-3"><Badge variant="outline">{r.terms_version}</Badge></td>
                    <td className="p-3 text-muted-foreground">{r.ip_address || '—'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => openTerms(r.terms_version)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => openTerms(r.terms_version, true)}><Download className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
                {!filteredAcceptances.length && (
                  <tr><td className="p-6 text-center text-muted-foreground" colSpan={6}>Nenhum aceite encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="downloads">
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Versão</th>
                  <th className="text-left p-3">Ação</th>
                  <th className="text-left p-3">Idioma</th>
                </tr>
              </thead>
              <tbody>
                {filteredDownloads.map(r => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="p-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="p-3">{r.client_id ? clients[r.client_id] || '—' : '—'}</td>
                    <td className="p-3">{r.email || '—'}</td>
                    <td className="p-3"><Badge variant="outline">{r.terms_version}</Badge></td>
                    <td className="p-3">
                      <Badge variant={r.action === 'download' ? 'default' : 'secondary'}>
                        {r.action === 'download' ? `Download (${r.format})` : 'Visualização'}
                      </Badge>
                    </td>
                    <td className="p-3 uppercase text-muted-foreground">{r.language}</td>
                  </tr>
                ))}
                {!filteredDownloads.length && (
                  <tr><td className="p-6 text-center text-muted-foreground" colSpan={6}>Nenhum download registrado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" /> Termos · {preview?.version}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {preview?.text}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
