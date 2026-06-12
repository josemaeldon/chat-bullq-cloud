# Chat BullQ

Plataforma omnichannel em monorepo:

- `frontend/`: painel Next.js.
- `backend/`: API NestJS, Prisma, filas e realtime.
- `docker-compose.yml`: PostgreSQL, Redis, MinIO, backend e frontend.

## Requisitos

Para instalar a stack completa com Docker:

- Git.
- Docker Engine 24+.
- Docker Compose v2.
- Um domínio com HTTPS para webhooks em produção.
- Opcionalmente, uma chave OpenAI para os recursos de IA.

Verifique:

```bash
git --version
docker --version
docker compose version
```

## Instalação com Docker

### 1. Clonar o repositório

```bash
git clone https://github.com/josemaeldon/chat-bullq-cloud.git
cd chat-bullq-cloud
```

### 2. Criar o arquivo de configuração

```bash
cp .env.example .env
```

O `.env` real não é enviado ao Git. Edite-o antes de subir a stack.

### 3. Gerar os segredos JWT

Execute duas vezes e use um resultado diferente em cada variável:

```bash
openssl rand -hex 64
```

Preencha:

```dotenv
JWT_SECRET=primeiro_resultado
JWT_REFRESH_SECRET=segundo_resultado
```

### 4. Alterar as credenciais

Substitua todos os valores `CHANGE_ME` no `.env`:

```dotenv
POSTGRES_PASSWORD=uma_senha_forte
DATABASE_URL=postgresql://chat_bullq:uma_senha_forte@postgres:5432/chat_bullq
MINIO_ROOT_PASSWORD=outra_senha_forte
JWT_SECRET=...
JWT_REFRESH_SECRET=...
```

Se a senha do PostgreSQL tiver `@`, `:`, `/`, `#` ou outros caracteres
reservados, codifique-a para URL dentro de `DATABASE_URL`.

Importante: `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` só criam as
credenciais na primeira inicialização de um volume vazio. Se o volume
`postgres_data` já existir, mudar essas variáveis não altera o usuário do banco.

### 5. Configurar as URLs

Para desenvolvimento local:

```dotenv
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001/api/v1
APP_URL=http://localhost:3001
```

Para produção:

```dotenv
FRONTEND_URL=https://app.seudominio.com
API_URL=https://api.seudominio.com/api/v1
APP_URL=https://api.seudominio.com
```

Regras:

- `FRONTEND_URL`: origem permitida pelo CORS, sem barra final.
- `API_URL`: URL pública do backend com `/api/v1`.
- `APP_URL`: URL pública do backend sem `/api/v1`; usada nos webhooks.
- `NEXT_PUBLIC_API_URL` é incorporada no build do frontend. Ao mudar
  `API_URL`, reconstrua a imagem do frontend.

### 6. Configurar recursos opcionais

Para habilitar recursos de IA:

```dotenv
OPENAI_API_KEY=sk-...
```

As variáveis `VAPID_*` habilitam notificações web push. Podem ficar vazias
durante a primeira instalação.

### 7. Validar a stack

```bash
docker compose config
```

Confira a saída e certifique-se de que nenhum `CHANGE_ME` permaneceu:

```bash
docker compose config | grep CHANGE_ME
```

O segundo comando não deve retornar nada.

### 8. Construir e iniciar

```bash
docker compose up -d --build
```

O container do backend executa automaticamente:

```bash
npx prisma migrate deploy
```

Não é necessário aplicar as migrações manualmente na instalação Docker.

### 9. Acompanhar a inicialização

```bash
docker compose ps
docker compose logs -f backend frontend
```

Quando estiver pronto:

- Frontend: <http://localhost:3000>
- API: <http://localhost:3001/api/v1>
- Swagger: <http://localhost:3001/docs>
- MinIO API: <http://localhost:9000>
- MinIO Console: <http://localhost:9001>

### 10. Criar o primeiro usuário

Acesse `/register` pelo frontend. O primeiro usuário criado em um novo
workspace recebe o papel `OWNER` da organização.

## Pontos que devem ser alterados

| Configuração | Obrigatória | Finalidade |
| --- | --- | --- |
| `POSTGRES_PASSWORD` e `DATABASE_URL` | Sim | Credenciais do banco. |
| `JWT_SECRET` | Sim | Assinatura dos tokens de acesso. |
| `JWT_REFRESH_SECRET` | Sim | Assinatura dos tokens de renovação. |
| `MINIO_ROOT_PASSWORD` | Sim | Proteção do armazenamento MinIO. |
| `FRONTEND_URL` | Em produção | Domínio público do painel e CORS. |
| `API_URL` | Em produção | Endpoint usado pelo navegador. |
| `APP_URL` | Para webhooks | URL pública recebida pelos provedores. |
| `OPENAI_API_KEY` | Para IA | Embeddings e recursos baseados em OpenAI. |
| `VAPID_*` | Para push | Notificações do navegador. |
| Portas públicas | Conforme ambiente | Evitar conflitos e exposição desnecessária. |

O `docker-compose.yml` contém comentários ao lado de cada ponto configurável.

## Produção

Em produção, use um proxy reverso como Traefik, Nginx ou Caddy:

```text
app.seudominio.com -> frontend:3000
api.seudominio.com -> backend:3001
```

Recomendações:

- Use HTTPS obrigatório.
- Não exponha PostgreSQL e Redis à internet; remova as respectivas seções
  `ports` do compose.
- Restrinja as portas do MinIO ou publique-o atrás do proxy.
- Use senhas únicas e um gerenciador de segredos.
- Faça backup dos volumes antes de atualizar.
- Defina `APP_URL` com uma URL acessível pela Evolution GO.

## Evolution GO

Depois que a plataforma estiver pública:

1. Acesse `Configurações > Canais`.
2. Escolha `WhatsApp (Evolution GO)`.
3. Informe a URL e a API Key global da Evolution GO.
4. Escolha criar uma instância ou usar uma existente.
5. Clique em `Conectar WhatsApp` e leia o QR Code.

Consulte [a documentação do canal](./backend/docs/evolution-go.md).

## Atualização

```bash
git pull
docker compose build --pull
docker compose up -d
docker image prune -f
```

As migrações pendentes são aplicadas automaticamente pelo backend.

## Backup

Backup do PostgreSQL:

```bash
docker compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > chat-bullq-backup.sql
```

Restauração:

```bash
cat chat-bullq-backup.sql | docker compose exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Os dados também estão nos volumes:

- `postgres_data`
- `minio_data`
- `backend_uploads`

Não execute `docker compose down -v` em produção: a opção `-v` remove volumes.

## Comandos úteis

```bash
# Parar sem apagar dados
docker compose down

# Reiniciar um serviço
docker compose restart backend

# Reconstruir o frontend após alterar API_URL
docker compose build frontend
docker compose up -d frontend

# Ver logs
docker compose logs -f --tail=200

# Conferir migrações
docker compose exec backend npx prisma migrate status
```

## Desenvolvimento sem Docker

Suba PostgreSQL e Redis, depois:

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

Em outro terminal:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npm run dev
```

## Estrutura

```text
.
├── backend/
│   ├── prisma/
│   ├── src/
│   └── docs/
├── frontend/
│   ├── public/
│   └── src/
├── .env.example
└── docker-compose.yml
```

## Documentação

- [Frontend](./frontend/README.md)
- [Evolution GO](./backend/docs/evolution-go.md)
