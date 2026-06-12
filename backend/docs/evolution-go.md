# Canal Evolution GO

O tipo `WHATSAPP_EVOLUTION_GO` integra o Chat BullQ com a Evolution GO para
receber e enviar mensagens do WhatsApp.

## Pré-requisitos

1. Uma instalação acessível da Evolution GO.
2. O `GLOBAL_API_KEY` da instalação.
3. `PUBLIC_URL` da stack apontando para uma URL HTTPS pública.
4. A licença da Evolution GO ativada. Antes da ativação, as rotas da API
   respondem `503`.

Para receber mídias, configure a Evolution GO com uma destas opções:

- `WEBHOOK_FILES=true`, para incluir o conteúdo em base64 no webhook.
- MinIO habilitado na Evolution GO, para receber `mediaUrl`.

Sem uma dessas opções, textos e status funcionam, mas a URL criptografada
original do WhatsApp não pode ser reproduzida diretamente pelo navegador.

Para testes locais, consulte
[TESTE_LOCAL.md](../../TESTE_LOCAL.md). O ambiente local usa a rede Docker
para os webhooks e, por isso, não precisa de túnel público.

## Ativação

Execute a migração e regenere o Prisma Client:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

No painel:

1. Abra `Configurações > Canais`.
2. Escolha `WhatsApp (Evolution GO)`.
3. Informe a URL base da Evolution GO.
4. Informe a API Key global.
5. Escolha `Criar nova` ou `Usar existente`.
6. Para uma nova instância, informe o nome e, opcionalmente, token e proxy.
7. Para uma existente, informe o Instance ID e, opcionalmente, o token.
8. Crie o canal e clique em `Conectar WhatsApp` para ler o QR Code.

No modo `Criar nova`, o backend chama `POST /instance/create`. Quando o token
não é informado, o Chat BullQ gera um UUID seguro porque versões atuais da
Evolution GO exigem o campo mesmo que a referência o apresente como opcional.
No modo `Usar existente`, o backend consulta `GET /instance/info/:instanceId`
quando precisa descobrir o token. As demais rotas usam esse token no header
`apikey`.

## Webhook

O compose repassa `PUBLIC_URL` ao backend como `APP_URL`. Com essa URL
configurada, o backend chama automaticamente
`POST /instance/connect` e registra:

```text
https://app.example.com/api/v1/webhooks/WHATSAPP_EVOLUTION_GO
```

Eventos assinados:

- `MESSAGE`
- `SEND_MESSAGE`
- `READ_RECEIPT`
- `CONNECTION`

O webhook é roteado por `instanceId` e autenticado comparando
`instanceToken` com o token salvo no canal.

## Recursos suportados

- Texto, imagem, áudio, vídeo, documento, sticker e localização.
- Respostas citadas.
- Reações.
- Indicador de digitação.
- Status enviado, entregue, lido e falha.
- Exclusão para todos quando o WhatsApp ainda permite revogar a mensagem.

## Endpoints usados

- `GET /instance/info/:instanceId`
- `GET /instance/status`
- `GET /instance/qr`
- `POST /instance/create`
- `POST /instance/connect`
- `POST /send/text`
- `POST /send/media`
- `POST /send/sticker`
- `POST /send/location`
- `POST /message/react`
- `POST /message/presence`
- `POST /message/delete`

## Diagnóstico

- `Instância encontrada, mas o WhatsApp não está conectado`: reconecte a
  instância ou leia o QR Code no painel da Evolution GO.
- `Não foi possível localizar a instância`: confira URL, API Key global e ID.
- Webhook sem eventos: confira `PUBLIC_URL`, HTTPS público e a assinatura de
  eventos da instância.
- Mídia sem preview: habilite `WEBHOOKFILES` ou o armazenamento MinIO na
  Evolution GO.
