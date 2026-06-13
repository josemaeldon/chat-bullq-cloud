import { MessageContentType } from '../../ports/types';
import { EvolutionGoMessageMapper } from './evolution-go.message-mapper';

describe('EvolutionGoMessageMapper', () => {
  const mapper = new EvolutionGoMessageMapper();

  it('normalizes an inbound text message', () => {
    const result = mapper.normalizeInbound({
      event: 'Message',
      data: {
        Info: {
          ID: 'msg-1',
          Chat: '5591999999999@s.whatsapp.net',
          Sender: '5591999999999@s.whatsapp.net',
          PushName: 'Cliente',
          Timestamp: 1710000000,
          IsFromMe: false,
          IsGroup: false,
          Type: 'text',
        },
        Message: { conversation: 'Olá' },
      },
    });

    expect(result).toMatchObject({
      externalMessageId: 'msg-1',
      externalContactId: '5591999999999@s.whatsapp.net',
      contactName: 'Cliente',
      contactPhone: '5591999999999',
      type: MessageContentType.TEXT,
      content: { text: 'Olá' },
      isEcho: false,
    });
  });

  it('turns webhook base64 media into a playable data URL', () => {
    const result = mapper.normalizeInbound({
      event: 'Message',
      data: {
        Info: {
          ID: 'msg-2',
          Chat: '5591999999999@s.whatsapp.net',
          Timestamp: '2026-06-12T10:00:00Z',
          MediaType: 'image',
        },
        Message: {
          imageMessage: {
            mimetype: 'image/jpeg',
            caption: 'Foto',
            fileLength: 12,
          },
        },
        base64: 'YWJj',
      },
    });

    expect(result?.content).toEqual({
      mediaUrl: 'data:image/jpeg;base64,YWJj',
      mimeType: 'image/jpeg',
      fileName: undefined,
      fileSize: 12,
      caption: 'Foto',
    });
  });

  it('detects media even when the provider omits an explicit media type', () => {
    const result = mapper.normalizeInbound({
      event: 'Message',
      data: {
        Info: {
          ID: 'msg-3',
          Chat: '5591999999999@s.whatsapp.net',
          Timestamp: 1710000000,
        },
        Message: {
          message: {
            audioMessage: {
              mimetype: 'audio/ogg',
              fileLength: 42,
            },
          },
        },
      },
    });

    expect(result?.type).toBe(MessageContentType.AUDIO);
    expect(result?.content).toMatchObject({
      mimeType: 'audio/ogg',
      fileSize: 42,
    });
  });

  it('falls back to a browser-friendly mime type for base64 images', () => {
    const result = mapper.normalizeInbound({
      event: 'Message',
      data: {
        Info: {
          ID: 'msg-4',
          Chat: '5591999999999@s.whatsapp.net',
          Timestamp: 1710000000,
          MediaType: 'image',
        },
        Message: {
          imageMessage: {
            caption: 'Foto',
            fileLength: 12,
          },
        },
        base64: 'YWJj',
      },
    });

    expect(result?.content?.mimeType).toBe('image/jpeg');
    expect(result?.content?.mediaUrl).toBe('data:image/jpeg;base64,YWJj');
  });

  it('normalizes every message id from a receipt', () => {
    const result = mapper.normalizeStatuses({
      event: 'Receipt',
      state: 'Delivered',
      data: {
        MessageIDs: ['msg-1', 'msg-2'],
        Timestamp: 1710000000,
      },
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.externalMessageId)).toEqual([
      'msg-1',
      'msg-2',
    ]);
    expect(result[0].status).toBe('delivered');
  });

  it('uses Evolution GO media and quoted payload fields', () => {
    const result = mapper.denormalize(
      {
        type: MessageContentType.DOCUMENT,
        content: {
          mediaUrl: 'https://cdn.example.com/file.pdf',
          fileName: 'file.pdf',
          caption: 'Contrato',
        },
        replyTo: { externalMessageId: 'quoted-id' },
      },
      '5591999999999@s.whatsapp.net',
    );

    expect(result).toEqual({
      endpoint: '/send/media',
      payload: {
        number: '5591999999999',
        url: 'https://cdn.example.com/file.pdf',
        type: 'document',
        caption: 'Contrato',
        filename: 'file.pdf',
        quoted: { messageId: 'quoted-id' },
      },
    });
  });
});
