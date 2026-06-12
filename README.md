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
- Um domínio com HTTPS em produção.
- Opcionalmente, uma chave OpenAI para os recursos de IA.

Verifique:

```bash
git --version
docker --version
docker compose version
```

## Instalação com Docker

### Instalação automática

O instalador cria o `.env`, gera senhas e segredos aleatórios, baixa as imagens
do GHCR e inicia a stack:

```bash
./scripts/install-stack.sh https://app.seudominio.com
```

Para pacotes GHCR privados:

```bash
GHCR_USER=seu_usuario \
GHCR_TOKEN=seu_token_read_packages \
./scripts/install-stack.sh https://app.seudominio.com
```

O script preserva um `.env` existente. SMTP, OpenAI e VAPID dependem de
provedores externos e devem ser preenchidos depois quando necessários.

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

### 5. Configurar a URL pública

Para desenvolvimento local:

```dotenv
PUBLIC_URL=http://localhost:3000
```

Para produção:

```dotenv
PUBLIC_URL=https://app.seudominio.com
```

O backend não precisa de domínio próprio. O navegador acessa a mesma origem
do frontend e o Next.js encaminha internamente:

```text
/api/v1/*   -> http://backend:3001/api/v1/*
/socket.io  -> http://backend:3001/socket.io
/docs       -> http://backend:3001/docs
```

Esse tráfego usa a rede privada do Docker. `PUBLIC_URL` também é usada para
montar URLs externas de uploads e webhooks, pois esses endereços precisam ser
acessíveis pelos navegadores e provedores.

### Rede exclusiva no Portainer

A stack cria a rede Docker `chat-bullq-cloud-internal`. PostgreSQL, Redis,
MinIO, backend e frontend ficam separados dos containers de outros projetos.
Somente a porta do frontend é publicada no host:

```dotenv
DOCKER_NETWORK_NAME=chat-bullq-cloud-internal
FRONTEND_PORT=3000
```

PostgreSQL, Redis, MinIO e backend não publicam portas. Eles são acessados
somente dentro dessa rede como `postgres:5432`, `redis:6379`, `minio:9000` e
`backend:3001`. A rede permite conexões de saída para Evolution GO, SMTP,
OpenAI e outros provedores externos.

### 6. Configurar recursos opcionais

Para habilitar recursos de IA:

```dotenv
OPENAI_API_KEY=sk-...
```

As variáveis `VAPID_*` habilitam notificações web push. Podem ficar vazias
durante a primeira instalação.

Para habilitar “Esqueci minha senha”, configure um servidor SMTP:

```dotenv
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-smtp
SMTP_PASSWORD=senha-smtp
SMTP_FROM=Chat BullQ <nao-responda@seudominio.com>
```

Use `SMTP_SECURE=true` normalmente apenas na porta `465`. Na porta `587`,
use `false`, pois a conexão é elevada para TLS por STARTTLS.

### 7. Validar a stack

```bash
docker compose config
```

Confira a saída e certifique-se de que nenhum `CHANGE_ME` permaneceu:

```bash
docker compose config | grep CHANGE_ME
```

O segundo comando não deve retornar nada.

### 8. Baixar as imagens e iniciar

```bash
docker compose pull
docker compose up -d
```

Por padrão, a stack usa:

```text
ghcr.io/josemaeldon/chat-bullq-cloud-backend:latest
ghcr.io/josemaeldon/chat-bullq-cloud-frontend:latest
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
- API pelo gateway: <http://localhost:3000/api/v1>
- Swagger pelo gateway: <http://localhost:3000/docs>
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
| `PUBLIC_URL` | Em produção | Único domínio do painel, API, uploads e webhooks. |
| `DOCKER_NETWORK_NAME` | Opcional | Nome da rede Docker exclusiva da stack. |
| `BACKEND_IMAGE` | Opcional | Imagem/tag do backend no GHCR. |
| `FRONTEND_IMAGE` | Opcional | Imagem/tag do frontend no GHCR. |
| `OPENAI_API_KEY` | Para IA | Embeddings e recursos baseados em OpenAI. |
| `SMTP_*` | Para recuperação de senha | Envio do link de redefinição. |
| `VAPID_*` | Para push | Notificações do navegador. |
| `FRONTEND_PORT` | Conforme ambiente | Única porta publicada no host. |

O `docker-compose.yml` contém comentários ao lado de cada ponto configurável.

## Produção

Em produção, use um proxy reverso como Traefik, Nginx ou Caddy:

```text
app.seudominio.com -> frontend:3000
frontend:3000      -> backend:3001 pela rede Docker
```

Recomendações:

- Use HTTPS obrigatório.
- Não conecte outros containers à rede `chat-bullq-cloud-internal`.
- PostgreSQL, Redis, MinIO e backend já estão sem portas publicadas.
- Use senhas únicas e um gerenciador de segredos.
- Faça backup dos volumes antes de atualizar.
- Defina `PUBLIC_URL` com uma URL acessível pela Evolution GO.
- Não publique a porta `3001`; o compose usa apenas `expose` na rede interna.

## Imagens no GHCR

O workflow [publish-ghcr.yml](./.github/workflows/publish-ghcr.yml) publica
automaticamente duas imagens, pois frontend e backend executam processos
diferentes:

```text
ghcr.io/josemaeldon/chat-bullq-cloud-backend
ghcr.io/josemaeldon/chat-bullq-cloud-frontend
```

Ele é executado:

- em todo push na branch `main` que altere frontend, backend ou o workflow;
- ao criar uma tag começando com `v`, por exemplo `v1.0.0`;
- manualmente em `Actions > Publish GHCR images > Run workflow`.

Tags publicadas:

- `latest`: commit mais recente da `main`;
- `v1.0.0`: versão correspondente a uma tag Git;
- `sha-abcdef0`: tag imutável baseada no commit.

As imagens são geradas somente para `linux/amd64`, com cache, SBOM e atestação
de procedência. O workflow usa `GITHUB_TOKEN`; não é necessário criar segredo
adicional no repositório.

Se os pacotes GHCR estiverem privados, autentique o servidor:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u SEU_USUARIO --password-stdin
```

O token precisa da permissão `read:packages`. Para instalação sem login, torne
os dois packages públicos em `GitHub > Packages > Package settings`.

Para usar uma versão fixa ou fazer rollback:

```dotenv
BACKEND_IMAGE=ghcr.io/josemaeldon/chat-bullq-cloud-backend:v1.0.0
FRONTEND_IMAGE=ghcr.io/josemaeldon/chat-bullq-cloud-frontend:v1.0.0
```

Depois:

```bash
docker compose pull
docker compose up -d
```

Para compilar localmente em vez de usar GHCR:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.build.yml \
  up -d --build
```

## Evolution GO

Depois que a plataforma estiver pública:

1. Acesse `Configurações > Canais`.
2. Escolha `WhatsApp (Evolution GO)`.
3. Informe a URL e a API Key global da Evolution GO.
4. Escolha criar uma instância ou usar uma existente.
5. Clique em `Conectar WhatsApp` e leia o QR Code.

Consulte [a documentação do canal](./backend/docs/evolution-go.md).

Para instalar a Evolution GO junto com um ambiente local isolado, sem criar
`.env` nem reutilizar bancos existentes, siga o
[guia de teste local](./TESTE_LOCAL.md). A versão oficial exige uma ativação
de licença no Manager antes de liberar as rotas da API.

## Recuperação de senha

O link `Esqueci minha senha` fica na tela de login. O fluxo:

1. Recebe o e-mail sem revelar se ele existe no sistema.
2. Gera um token aleatório e salva somente seu hash.
3. Envia um link no único domínio público da plataforma.
4. Expira o link em 1 hora e permite apenas um uso.
5. Invalida sessões anteriores quando a senha é alterada.

Em desenvolvimento, se SMTP não estiver configurado, o backend registra a URL
de recuperação nos logs. Em produção, configure SMTP obrigatoriamente.

## Atualização

```bash
git pull
docker compose pull
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

# Atualizar para as imagens mais recentes
docker compose pull
docker compose up -d

# Build local para desenvolvimento
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build

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
INTERNAL_API_URL=http://localhost:3001 NEXT_PUBLIC_API_URL=/api/v1 npm run dev
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
