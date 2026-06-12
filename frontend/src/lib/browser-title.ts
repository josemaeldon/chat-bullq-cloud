const PAGE_TITLES: Array<{ match: (pathname: string) => boolean; title: string }> = [
  { match: (pathname) => pathname === '/dashboard', title: 'Dashboard' },
  { match: (pathname) => pathname === '/inbox', title: 'Conversas' },
  { match: (pathname) => pathname.startsWith('/chatbot'), title: 'Chatbot' },
  { match: (pathname) => pathname.startsWith('/conexoes'), title: 'Conexões' },
  { match: (pathname) => pathname.startsWith('/contacts'), title: 'Contatos' },
  { match: (pathname) => pathname.startsWith('/pipelines'), title: 'Kanban' },
  { match: (pathname) => pathname.startsWith('/ai-agents'), title: 'Agentes' },
  { match: (pathname) => pathname.startsWith('/base-conhecimento'), title: 'Base de Conhecimento' },
  { match: (pathname) => pathname.startsWith('/vozes'), title: 'Vozes' },
  { match: (pathname) => pathname.startsWith('/automations'), title: 'Automações' },
  { match: (pathname) => pathname.startsWith('/tarefas'), title: 'Tarefas' },
  { match: (pathname) => pathname.startsWith('/settings/general'), title: 'Geral' },
  { match: (pathname) => pathname.startsWith('/settings/ai'), title: 'Inteligência Artificial' },
  { match: (pathname) => pathname.startsWith('/settings/channels'), title: 'Canais' },
  { match: (pathname) => pathname.startsWith('/settings/integrations'), title: 'Integrações' },
  { match: (pathname) => pathname.startsWith('/settings/members'), title: 'Membros' },
  { match: (pathname) => pathname.startsWith('/settings/notifications'), title: 'Notificações' },
  { match: (pathname) => pathname.startsWith('/settings/departments'), title: 'Departamentos' },
  { match: (pathname) => pathname.startsWith('/settings/statuses'), title: 'Status' },
  { match: (pathname) => pathname.startsWith('/settings/tags'), title: 'Tags' },
  { match: (pathname) => pathname.startsWith('/settings/api-keys'), title: 'Credenciais API' },
];

export function getWorkspacePageTitle(pathname: string): string {
  const match = PAGE_TITLES.find((entry) => entry.match(pathname));
  return match?.title ?? 'Chat';
}

export function formatWorkspaceTitle(workspaceName: string, pageTitle: string): string {
  const left = workspaceName.trim() || 'Chat BullQ';
  const right = pageTitle.trim() || 'Chat';
  return `${left} | ${right}`;
}
