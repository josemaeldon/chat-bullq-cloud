'use client';

import { useEffect, useState } from 'react';
import {
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  Zap,
  Power,
  PowerOff,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Lock,
  Globe,
  QrCode,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Channel } from '../services/channels.service';
import { channelsService } from '../services/channels.service';
import { useChannelSync } from '../hooks/use-channel-sync';
import { EvolutionGoIcon, ZappfyIcon, MetaIcon, InstagramIcon } from '@/components/ui/icons';
import { EditChannelDialog } from './edit-channel-dialog';

const channelTypeMap: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  WHATSAPP_ZAPPFY: { label: 'WhatsApp (Zappfy)', icon: ZappfyIcon, color: 'bg-zinc-50 dark:bg-zinc-800' },
  WHATSAPP_EVOLUTION_GO: { label: 'WhatsApp (Evolution GO)', icon: EvolutionGoIcon, color: 'bg-zinc-50 dark:bg-zinc-800' },
  WHATSAPP_EVOLUTION_API: { label: 'WhatsApp (Evolution API v2)', icon: EvolutionGoIcon, color: 'bg-zinc-50 dark:bg-zinc-800' },
  WHATSAPP_OFFICIAL: { label: 'WhatsApp Official', icon: MetaIcon, color: 'bg-zinc-50 dark:bg-zinc-800' },
  INSTAGRAM: { label: 'Instagram', icon: InstagramIcon, color: 'bg-zinc-50 dark:bg-zinc-800' },
};

interface ChannelCardProps {
  channel: Channel;
  onUpdate: () => void;
}

export function ChannelCard({ channel, onUpdate }: ChannelCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const meta =
    channelTypeMap[channel.type] || {
      label: channel.type,
      icon: MessageSquare,
      color: 'bg-gray-500',
    };
  const Icon = meta.icon;
  const sync = useChannelSync({ channelId: channel.id, channelType: channel.type });

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const result = await channelsService.testConnection(channel.id);
      if (result.success) {
        toast.success(`Conexão OK: ${typeof result.status === 'string' ? result.status : JSON.stringify(result.status)}`);
      } else {
        toast.error(`Falha: ${result.error}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao testar conexão');
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggle = async () => {
    try {
      await channelsService.update(channel.id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? 'Canal desativado' : 'Canal ativado');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar canal');
    }
  };

  const handleToggleVisibility = async () => {
    const goingPrivate = channel.visibility !== 'PRIVATE';
    if (goingPrivate) {
      const ok = window.confirm(
        'Tornar este canal privado?\n\n' +
          'Apenas você e quem você der permissão explícita verão esse canal — ' +
          'OWNERs e ADMINs da org NÃO terão acesso automático.\n\n' +
          'Você pode liberar acesso pra outros membros depois pelas configurações de membros.',
      );
      if (!ok) return;
    }
    try {
      await channelsService.update(channel.id, {
        visibility: goingPrivate ? 'PRIVATE' : 'ORG',
      });
      toast.success(goingPrivate ? 'Canal agora é privado' : 'Canal agora é público na org');
      onUpdate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao alterar visibilidade',
      );
    }
  };

  const handleDelete = async () => {
    const typed = prompt(
      `Para remover o canal, digite o nome exato:\n\n"${channel.name}"\n\nMensagens e conversas são preservadas no histórico, mas o canal ficará inativo.`,
    );
    if (typed == null) return;
    if (typed.trim() !== channel.name) {
      toast.error('Nome não confere — cancelado.');
      return;
    }
    try {
      await channelsService.remove(channel.id, typed.trim());
      toast.success('Canal removido');
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover canal');
    }
  };

  const handleSync = async () => {
    try {
      await sync.startSync();
      toast.success('Sincronização iniciada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao iniciar sincronização');
    }
  };

  const handleCancelSync = async () => {
    try {
      await sync.cancelSync();
      toast.success('Sincronização cancelada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar sincronização');
    }
  };

  const isSyncRunning = sync.job?.status === 'RUNNING' || sync.job?.status === 'PENDING';
  const isSyncCompleted = sync.job?.status === 'COMPLETED';
  const isSyncFailed = sync.job?.status === 'FAILED';
  const progressPct =
    sync.job && sync.job.conversationsTotal > 0
      ? Math.min(100, Math.round((sync.job.conversationsImported / sync.job.conversationsTotal) * 100))
      : 0;

  return (
    <div className="relative flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 ${meta.color}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {channel.name}
          </h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              channel.isActive
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {channel.isActive ? 'Ativo' : 'Inativo'}
          </span>
          {channel.visibility === 'PRIVATE' && (
            <span
              title="Canal privado — só membros com permissão explícita enxergam, mesmo OWNER/ADMIN"
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <Lock className="h-3 w-3" />
              Privado
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{meta.label}</p>

        {sync.supported && sync.job && (
          <div className="mt-3">
            {isSyncRunning && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sincronizando
                    {sync.job.conversationsTotal > 0 && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {sync.job.conversationsImported}/{sync.job.conversationsTotal} conversas · {sync.job.messagesImported} msgs
                      </span>
                    )}
                  </span>
                  <button
                    onClick={handleCancelSync}
                    className="text-xs font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full bg-pink-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
            {isSyncCompleted && (
              <p className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {sync.job.conversationsImported} conversas, {sync.job.messagesImported} mensagens sincronizadas
              </p>
            )}
            {isSyncFailed && (
              <p className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="h-3 w-3" />
                Sync falhou: {sync.job.errorMessage || 'erro desconhecido'}
              </p>
            )}
            {sync.job.status === 'CANCELLED' && (
              <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                <XCircle className="h-3 w-3" />
                Sincronização cancelada
              </p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {isTesting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Zap className="h-3 w-3" />
            )}
            Testar Conexão
          </button>
          {sync.supported && (
            <button
              onClick={handleSync}
              disabled={isSyncRunning || sync.loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {sync.loading || isSyncRunning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Sincronizar
            </button>
          )}
          {(channel.type === 'WHATSAPP_EVOLUTION_GO' || channel.type === 'WHATSAPP_EVOLUTION_API') && (
            <button
              onClick={() => setShowQr(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
            >
              <QrCode className="h-3 w-3" />
              Conectar WhatsApp
            </button>
          )}
          <button
            onClick={handleToggle}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {channel.isActive ? (
              <PowerOff className="h-3 w-3" />
            ) : (
              <Power className="h-3 w-3" />
            )}
            {channel.isActive ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => { setEditing(true); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <Pencil className="h-4 w-4" />
                Editar credenciais
              </button>
              <button
                onClick={() => { handleToggleVisibility(); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                {channel.visibility === 'PRIVATE' ? (
                  <>
                    <Globe className="h-4 w-4" />
                    Tornar público na org
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Tornar privado
                  </>
                )}
              </button>
              <button
                onClick={() => { handleDelete(); setShowMenu(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            </div>
          </>
        )}
      </div>
      <EditChannelDialog
        channel={editing ? channel : null}
        onClose={() => setEditing(false)}
        onSaved={onUpdate}
      />
      <EvolutionGoQrDialog
        channel={showQr ? channel : null}
        onClose={() => setShowQr(false)}
      />
    </div>
  );
}

function EvolutionGoQrDialog({
  channel,
  onClose,
}: {
  channel: Channel | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const normalizeQrCode = (value: string | null | undefined) => {
    if (!value) return null;
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `data:image/png;base64,${value}`;
  };

  const loadQr = async () => {
    if (!channel) return;
    setLoading(true);
    try {
      const result = await channelsService.getEvolutionGoQr(channel.id);
      setConnected(result.connected);
      setQrCode(normalizeQrCode(result.qrCode));
      setPairingCode(result.pairingCode ?? null);
      setRawCode(result.code ?? null);
      if (result.connected) toast.success('WhatsApp já está conectado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar QR Code');
    } finally {
      setLoading(false);
    }
  };

  if (!channel) return null;

  useEffect(() => {
    setQrCode(null);
    setPairingCode(null);
    setRawCode(null);
    setConnected(false);
    void loadQr();
  }, [channel?.id]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-zinc-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
        >
          <X className="h-5 w-5" />
        </button>
        <EvolutionGoIcon className="mx-auto h-12 w-12" />
        <h3 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Conectar {channel.name}
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          {channel.config?.apiVersion === 'v2'
            ? 'Use o QR Code ou o pairing code retornado pela Evolution API v2.'
            : 'No WhatsApp, abra Aparelhos conectados e escaneie o QR Code.'}
        </p>

        <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          ) : connected ? (
            <div className="text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mx-auto h-12 w-12" />
              <p className="mt-2 text-sm font-medium">WhatsApp conectado</p>
            </div>
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code da Evolution GO" className="h-56 w-56" />
          ) : pairingCode || rawCode ? (
            <div className="space-y-3 px-3">
              {pairingCode && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Pairing code
                  </p>
                  <p className="mt-1 rounded-lg bg-white px-3 py-2 font-mono text-lg font-semibold text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                    {pairingCode}
                  </p>
                </div>
              )}
              {rawCode && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    Código retornado pela API
                  </p>
                  <p className="break-all rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                    {rawCode}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <QrCode className="h-16 w-16 text-zinc-300 dark:text-zinc-600" />
          )}
        </div>

        {!connected && (
          <button
            type="button"
            onClick={loadQr}
            disabled={loading}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {qrCode ? 'Atualizar QR Code' : 'Gerar QR Code'}
          </button>
        )}
      </div>
    </div>
  );
}
