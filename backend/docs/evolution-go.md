# Canal Evolution GO

O tipo `WHATSAPP_EVOLUTION_GO` integra o Chat BullQ com a Evolution GO para
receber e enviar mensagens do WhatsApp.

## Pré-requisitos

1. Uma instalação acessível da Evolution GO.
2. O `GLOBAL_API_KEY` da instalação.
3. Uma instância já criada na Evolution GO.
4. O ID da instância.
5. `APP_URL` no backend apontando para uma URL HTTPS pública.

Para receber mídias, configure a Evolution GO com uma destas opções:

- `WEBHOOKFILES=true`, para incluir o conteúdo em base64 no webhook.
- MinIO habilitado na Evolution GO, para receber `mediaUrl`.

Sem uma dessas opções, textos e status funcionam, mas a URL criptografada
original do WhatsApp não pode ser reproduzida diretamente pelo navegador.

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
5. Informe o Instance ID.
6. Opcionalmente informe o token da instância.
7. Crie o canal e use `Testar conexão`.

Quando o token não é informado, o backend consulta
`GET /instance/info/:instanceId` com a chave global e salva o token específico
da instância. As demais rotas usam esse token no header `apikey`.

## Webhook

Com `APP_URL` configurado, o backend chama automaticamente
`POST /instance/connect` e registra:

```text
https://api.example.com/api/v1/webhooks/WHATSAPP_EVOLUTION_GO
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
- Webhook sem eventos: confira `APP_URL`, HTTPS público e a assinatura de
  eventos da instância.
- Mídia sem preview: habilite `WEBHOOKFILES` ou o armazenamento MinIO na
  Evolution GO.
