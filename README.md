# Chat BullQ

Mono-repo da plataforma Chat BullQ separado em:

- `frontend/`: painel web em Next.js
- `backend/`: API em NestJS + Prisma

## Estrutura

```text
.
├── frontend/   # app web
└── backend/    # API, banco, filas e realtime
```

## O que cada parte faz

### Frontend

O frontend cuida da experiência do operador:

- login e registro
- inbox em tempo real
- dashboard
- canais e conexões
- chatbot
- pipelines
- agentes de IA
- integrações

Arquivos principais:

- [frontend/src/app/layout.tsx](./frontend/src/app/layout.tsx)
- [frontend/src/app/(dashboard)/inbox/page.tsx](./frontend/src/app/(dashboard)/inbox/page.tsx)
- [frontend/src/lib/api.ts](./frontend/src/lib/api.ts)

### Backend

O backend concentra a lógica de negócio:

- autenticação
- multi-organização
- webhooks
- mensagens
- canais
- automações
- chatbot
- IA
- realtime

Arquivos principais:

- [backend/src/main.ts](./backend/src/main.ts)
- [backend/src/app.module.ts](./backend/src/app.module.ts)
- [backend/prisma/schema.prisma](./backend/prisma/schema.prisma)

## Como rodar

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run start:dev
```

### Tudo junto

```bash
docker compose up --build
```

## Stack local

O `docker-compose.yml` da raiz sobe:

- frontend
- backend
- postgres
- redis
- minio

## Variáveis importantes

- `frontend`: usa `NEXT_PUBLIC_API_URL`
- `backend`: usa `DATABASE_URL`, `JWT_SECRET`, `REDIS_HOST`, `MINIO_*` e `CORS_ORIGIN`

## Documentação por pasta

- [frontend/README.md](./frontend/README.md)
- [Canal Evolution GO](./backend/docs/evolution-go.md)
