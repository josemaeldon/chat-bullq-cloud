'use client';

import { type ComponentType, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Globe, ImageIcon, Layers3 } from 'lucide-react';
import { toast } from 'sonner';
import { organizationGeneralService } from '@/features/settings/services/organization-general.service';
import { useAuthStore } from '@/stores/auth-store';

export default function SettingsGeneralPage() {
  const queryClient = useQueryClient();
  const updateActiveOrganization = useAuthStore((state) => state.updateActiveOrganization);
  const { data, isLoading } = useQuery({
    queryKey: ['organization-general'],
    queryFn: () => organizationGeneralService.get(),
  });

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [browserTabIconUrl, setBrowserTabIconUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? '');
    setLogoUrl(data.logoUrl ?? '');
    setBrowserTabIconUrl(data.browserTabIconUrl ?? '');
  }, [data]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedLogoUrl = logoUrl.trim();
    const trimmedBrowserTabIconUrl = browserTabIconUrl.trim();

    if (!trimmedName) {
      toast.error('Informe o nome da organização');
      return;
    }

    setSaving(true);
    try {
      const updated = await organizationGeneralService.update({
        name: trimmedName,
        logoUrl: trimmedLogoUrl || null,
        browserTabIconUrl: trimmedBrowserTabIconUrl || null,
      });

      updateActiveOrganization({
        name: updated.name,
        slug: updated.slug,
        browserTabIconUrl: updated.browserTabIconUrl,
      });
      queryClient.invalidateQueries({ queryKey: ['organization-general'] });
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success('Configurações gerais salvas');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-56 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <Building2 className="h-5 w-5 text-primary" />
            Geral
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Ajuste a identidade e os dados principais da sua organização
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex-1 space-y-5">
            <div>
              <label
                htmlFor="organization-name"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                Nome da organização
              </label>
              <input
                id="organization-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: BullQ Cloud"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Esse nome aparece no seletor de organização e em áreas internas da plataforma.
              </p>
            </div>

            <div>
              <label
                htmlFor="organization-browser-icon"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                Ícone da aba do navegador
              </label>
              <div className="relative mt-2">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="organization-browser-icon"
                  value={browserTabIconUrl}
                  onChange={(e) => setBrowserTabIconUrl(e.target.value)}
                  placeholder="https://exemplo.com/favicon.png"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Pode ser PNG, JPG, SVG ou ICO. Se ficar vazio, o sistema usa o ícone padrão atual.
              </p>
            </div>

            <div>
              <label
                htmlFor="organization-logo"
                className="block text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                URL do logo
              </label>
              <div className="relative mt-2">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="organization-logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://exemplo.com/logo.png"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Use uma imagem pública em PNG, JPG ou SVG para identificar a organização.
              </p>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-80">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Pré-visualização
              </p>
              <div className="mt-4 flex items-center gap-3">
                {(browserTabIconUrl.trim() || logoUrl.trim()) ? (
                  <img
                    src={browserTabIconUrl.trim() || logoUrl.trim()}
                    alt={name || 'Logo da organização'}
                    className="h-14 w-14 rounded-2xl border border-zinc-200 bg-white object-cover p-2 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {name.trim() || 'Nome da organização'}
                  </p>
                  <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {data?.slug || 'slug-da-organizacao'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <InfoRow
                  icon={Globe}
                  label="Slug"
                  value={data?.slug || 'Não definido'}
                  helper="Identificador interno da organização."
                />
                <InfoRow
                  icon={Layers3}
                  label="Plano"
                  value={formatPlanLabel(data?.plan)}
                  helper="Plano atual associado ao workspace."
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</p>
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function formatPlanLabel(plan?: string) {
  if (!plan) return 'Não definido';
  return plan
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
