# Chat BullQ Cloud

Plataforma web de atendimento omnichannel com inbox em tempo real, canais de entrada, automações, chatbot, pipelines, agentes de IA e integrações por organização.

## Visão Geral

Este repositório contém o frontend da aplicação. Ele foi feito com Next.js e consome uma API externa por meio de `axios`, com autenticação por `access_token` e `refresh_token`, além de suporte a organização ativa via header `x-organization-id`.

### Stack principal

- `Next.js`
- `React 19`
- `TypeScript`
- `TanStack React Query`
- `Zustand`
- `Socket.IO`
- `Tailwind CSS`
- `sonner` para notificações

## Como a aplicação funciona

### 1. Entrada na aplicação

Ao acessar a raiz, o app redireciona para o inbox em `/inbox`.

- Arquivo: [src/app/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/page.tsx)

### 2. Autenticação

O usuário faz login em `/login` ou cadastro em `/register`.

- O login chama `POST /auth/login`
- O retorno traz `user`, `organizations`, `accessToken` e `refreshToken`
- Os tokens ficam salvos no `localStorage`
- A organização ativa também é salva em `active_org_id`

Se uma requisição voltar `401`, o cliente tenta renovar o token em `POST /auth/refresh` e repete a chamada.

- Componentes e serviço:
  - [src/features/auth/components/login-form.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/auth/components/login-form.tsx)
  - [src/features/auth/services/auth.service.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/auth/services/auth.service.ts)
  - [src/lib/api.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/lib/api.ts)

### 3. Carregamento do dashboard

Depois do login, o layout protegido verifica se existe token e busca os dados de sessão com `GET /auth/me`.

- Se não houver token, o usuário volta para `/login`
- Se houver sessão válida, o app carrega usuário e organizações no store global
- O layout do dashboard monta a sidebar, a navbar e banners globais

- Arquivo: [src/app/(dashboard)/layout.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/layout.tsx)

### 4. Organização ativa

O app é multi-organização.

- `setAuth` escolhe a organização ativa
- Se houver `active_org_id` salvo e ele ainda for válido, ele é reutilizado
- Caso contrário, a primeira organização disponível é usada
- Todas as requisições levam esse contexto no header `x-organization-id`

- Arquivo: [src/stores/auth-store.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/stores/auth-store.ts)

### 5. Navegação

A sidebar organiza o produto em áreas:

- Dashboard
- Conexões
- Atendimento: Conversas, Contatos, Kanban
- Automações: Agentes, Base de Conhecimento, Vozes, Chatbot, Automações, Integrações
- Tarefas
- Configurações

- Arquivo: [src/components/layout/app-sidebar.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/components/layout/app-sidebar.tsx)

## Fluxo principal do atendimento

### 1. Conexões

Em `/conexoes` o usuário vê os canais conectados à organização.

- Tipos atuais:
  - `WHATSAPP_ZAPPFY`
  - `WHATSAPP_OFFICIAL`
  - `INSTAGRAM`

O usuário cria conexões em `/settings/channels`, fornecendo credenciais e webhook de cada provedor.

- Lista: [src/app/(dashboard)/conexoes/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/conexoes/page.tsx)
- Criação: [src/features/channels/components/create-channel-dialog.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/channels/components/create-channel-dialog.tsx)
- Serviço: [src/features/channels/services/channels.service.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/channels/services/channels.service.ts)

### 2. Inbox

O inbox é o núcleo operacional.

Ao abrir `/inbox`:

- a lista de conversas é carregada
- uma conversa pode ser aberta pela seleção normal ou por deep link com `conversationId`
- a conversa ativa é mantida sincronizada com o backend
- o chat pode alternar painel de contato, notas, IA e ações rápidas

O inbox também dispara invalidações de cache quando a conversa muda, para manter a lista, contadores e mensagens atualizados.

- Página: [src/app/(dashboard)/inbox/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/inbox/page.tsx)
- Serviço: [src/features/inbox/services/inbox.service.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/inbox/services/inbox.service.ts)

### 3. Tempo real

As atualizações em tempo real usam `socket.io-client`.

- O socket autentica com `access_token` e `active_org_id`
- A sala de conversa só entra depois do evento `ready`
- Em reconexões, o app refaz sincronizações importantes

- Socket base: [src/lib/socket.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/lib/socket.ts)
- Hook: [src/features/inbox/hooks/use-socket.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/inbox/hooks/use-socket.ts)

### 4. Ações na conversa

A conversa suporta:

- enviar mensagem de texto
- enviar áudio
- enviar mídia
- resumir conversa com IA
- criar e excluir notas
- arquivar, reabrir e fechar conversas
- atribuir responsável
- marcar como lida ou não lida
- alternar IA por conversa
- disparar ações em lote

Tudo isso fica centralizado em [src/features/inbox/services/inbox.service.ts](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/features/inbox/services/inbox.service.ts).

## Outras áreas da aplicação

### Dashboard

O dashboard mostra métricas de atendimento, volume, performance de agentes, satisfação e reaberturas.

- Arquivo: [src/app/(dashboard)/dashboard/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/dashboard/page.tsx)

### Pipelines

Os pipelines funcionam como um Kanban por organização, com criação, remoção, marcação como padrão e visualização dos cards.

- Arquivo: [src/app/(dashboard)/pipelines/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/pipelines/page.tsx)

### Chatbot

A área de chatbot permite criar fluxos, ativar/desativar e abrir o editor do fluxo.

- Arquivo: [src/app/(dashboard)/chatbot/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/chatbot/page.tsx)

### Agentes de IA

A área `Jarvis` centraliza a gestão de agentes, skills, tools, execuções e watchdog operacional.

- Arquivo: [src/app/(dashboard)/ai-agents/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/ai-agents/page.tsx)

### Integrações

Hoje a tela de integrações do settings está focada em ZapSign, com status de conexão, sincronização de modelos e desconexão.

- Arquivo: [src/app/(dashboard)/settings/integrations/page.tsx](/Users/jose/Documents/GitHub/chat-bullq-cloud/src/app/(dashboard)/settings/integrations/page.tsx)

## Estrutura de pastas

- `src/app`: rotas da aplicação
- `src/components`: componentes compartilhados de UI e layout
- `src/features`: módulos de negócio, separados por domínio
- `src/hooks`: hooks utilitários compartilhados
- `src/lib`: cliente HTTP, socket, query client e utilitários
- `src/stores`: estado global com Zustand

## Passo a passo para entender a aplicação

1. O usuário acessa a aplicação e é redirecionado para o inbox.
2. Se não estiver autenticado, o layout manda para `/login`.
3. Após o login, o app salva tokens e organizações no navegador.
4. O dashboard protegido consulta `/auth/me` e define a organização ativa.
5. A sidebar expõe as áreas principais do produto.
6. O usuário cria ou usa conexões para WhatsApp ou Instagram.
7. As mensagens chegam via backend/webhook e aparecem no inbox.
8. O socket mantém a conversa sincronizada em tempo real.
9. O atendente executa ações como responder, arquivar, atribuir, resumir ou acionar IA.
10. O restante do sistema organiza automações, chatbot, pipelines e agentes.

## Como evoluir a integração

Se você for adicionar um novo provedor, o fluxo mais comum é:

1. criar o tipo no service de canais
2. adicionar o formulário de configuração
3. criar o endpoint de webhook correspondente no backend
4. mapear mensagens recebidas para a estrutura de `conversation` e `message`
5. invalidar cache e atualizar o socket quando o evento chegar

## Execução local

Os scripts disponíveis no projeto são:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

O frontend espera uma API configurada em `NEXT_PUBLIC_API_URL`. Se essa variável não existir, ele usa `http://localhost:3001/api/v1`.

