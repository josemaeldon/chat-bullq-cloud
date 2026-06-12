# Teste local com Evolution GO

Este ambiente executa Chat BullQ, PostgreSQL, Redis, MinIO e Evolution GO em
containers isolados. Nenhum `.env` precisa ser criado e nenhum serviço local
existente é reutilizado.

## Requisitos

- Docker Desktop em execução.
- Docker Compose v2.
- Portas `3100` e `8080` livres.

## Iniciar

Execute na raiz do repositório:

```bash
export COMPOSE_PROJECT_NAME=chat-bullq-local-test
export DOCKER_NETWORK_NAME=chat-bullq-local-test-internal
export FRONTEND_PORT=3100
export PUBLIC_URL=http://localhost:3100

export POSTGRES_USER=chat_bullq_test
export POSTGRES_DB=chat_bullq_test
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

export MINIO_ROOT_USER=chat_bullq_test
export MINIO_ROOT_PASSWORD="$(openssl rand -hex 24)"
export JWT_SECRET="$(openssl rand -hex 64)"
export JWT_REFRESH_SECRET="$(openssl rand -hex 64)"

docker compose \
  -f docker-compose.yml \
  -f docker-compose.build.yml \
  -f docker-compose.evolution-go.yml \
  up -d --build
```

Endereços:

- Chat BullQ: <http://localhost:3100>
- Evolution GO: <http://localhost:8080>
- Swagger Evolution GO: <http://localhost:8080/swagger/index.html>

## Configurar o canal

No Chat BullQ, abra `Configurações > Canais > WhatsApp (Evolution GO)` e use:

```text
URL da API: http://evolution-go:8080
API Key global: evolution-go-local-key
Modo: Criar nova
```

O endereço `evolution-go` funciona porque os dois sistemas estão na mesma rede
Docker. O backend configura o webhook interno automaticamente em:

```text
http://frontend:3000/api/v1/webhooks/WHATSAPP_EVOLUTION_GO
```

Depois de criar o canal, clique em `Conectar WhatsApp` e leia o QR Code. A
Evolution GO inclui as mídias em base64 nos webhooks durante os testes.

## Verificar

```bash
docker compose -p chat-bullq-local-test ps

curl http://localhost:8080/
curl -I http://localhost:3100/login

docker logs -f chat-bullq-local-test-evolution-go-1
docker logs -f chat-bullq-local-test-backend-1
```

## Parar e retomar

Os dados e a sessão do WhatsApp são preservados:

```bash
docker compose -p chat-bullq-local-test stop
docker compose -p chat-bullq-local-test start
```

## Remover completamente

Este comando apaga somente os containers, a rede, os bancos e a sessão do
projeto local de teste:

```bash
DOCKER_NETWORK_NAME=chat-bullq-local-test-internal \
docker compose \
  -p chat-bullq-local-test \
  -f docker-compose.yml \
  -f docker-compose.build.yml \
  -f docker-compose.evolution-go.yml \
  down -v
```

## Personalizar

As configurações locais possuem valores padrão e podem ser substituídas antes
de iniciar:

```bash
export EVOLUTION_GO_API_KEY="outra-chave-local"
export EVOLUTION_GO_DB_PASSWORD="outra-senha-local"
export EVOLUTION_GO_PORT=8081
export EVOLUTION_GO_VERSION=0.7.1
```

Se alterar a API Key, informe o mesmo valor ao criar o canal no Chat BullQ.
