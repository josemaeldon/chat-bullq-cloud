import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import {
  MessageContentType,
  NormalizedInboundMessage,
  NormalizedOutboundMessage,
  StatusUpdate,
} from '../../ports/types';

@Injectable()
export class EvolutionGoMessageMapper {
  normalizeInbound(event: any): NormalizedInboundMessage | null {
    const data = event?.data ?? {};
    const info = data?.Info ?? data?.info;
    const message = data?.Message ?? data?.message;
    if (!info || !message || !info.ID) return null;

    const chat = String(info.Chat || info.Sender || '');
    if (!chat) return null;

    const isGroup = info.IsGroup === true || chat.endsWith('@g.us');
    const isEcho = info.IsFromMe === true;
    const type = this.resolveContentType(info, message);
    const nested = this.findMessageNode(message, type);
    const contextInfo = nested?.contextInfo || message?.contextInfo;
    const contactName = isEcho ? undefined : info.PushName || undefined;

    const normalized: NormalizedInboundMessage = {
      externalMessageId: String(info.ID),
      externalContactId: chat,
      contactName,
      contactPhone: isGroup ? undefined : this.phoneFromJid(chat),
      channelType: ChannelType.WHATSAPP_EVOLUTION_GO,
      timestamp: this.toDate(info.Timestamp),
      type,
      content: this.extractContent(data, message, nested, type),
      isForwarded: !!contextInfo?.isForwarded,
      isGroup,
      isEcho,
      senderName: isGroup ? info.PushName || this.phoneFromJid(info.Sender) : undefined,
      rawPayload: event,
    };

    const replyId = contextInfo?.stanzaID || contextInfo?.stanzaId;
    if (replyId) {
      normalized.replyTo = { externalMessageId: String(replyId) };
    }
    return normalized;
  }

  normalizeStatuses(event: any): StatusUpdate[] {
    const data = event?.data ?? {};
    const ids = data?.MessageIDs || data?.MessageIds || data?.messageIds || [];
    const status = this.mapStatus(event?.state || data?.Type || data?.type);
    if (!status || !Array.isArray(ids)) return [];

    return ids.filter(Boolean).map((id: unknown) => ({
      externalMessageId: String(id),
      status,
      timestamp: this.toDate(data?.Timestamp || data?.timestamp),
    }));
  }

  denormalize(
    message: NormalizedOutboundMessage,
    contactExternalId: string,
  ): { endpoint: string; payload: Record<string, any> } {
    const number = contactExternalId.replace(/@.+$/, '');
    const replyId = message.replyTo?.externalMessageId;
    const quoted = replyId ? { quoted: { messageId: replyId } } : {};

    switch (message.type) {
      case MessageContentType.IMAGE:
      case MessageContentType.AUDIO:
      case MessageContentType.VIDEO:
      case MessageContentType.DOCUMENT:
        return {
          endpoint: '/send/media',
          payload: {
            number,
            url: message.content.mediaUrl,
            type: message.type.toLowerCase(),
            caption: message.content.caption || '',
            filename: message.content.fileName || '',
            ...quoted,
          },
        };
      case MessageContentType.STICKER:
        return {
          endpoint: '/send/sticker',
          payload: {
            number,
            sticker: message.content.mediaUrl,
            ...quoted,
          },
        };
      case MessageContentType.LOCATION:
        return {
          endpoint: '/send/location',
          payload: {
            number,
            name: message.content.text || '',
            latitude: message.content.latitude,
            longitude: message.content.longitude,
            ...quoted,
          },
        };
      case MessageContentType.REACTION:
        return {
          endpoint: '/message/react',
          payload: {
            number,
            id: message.content.reaction?.targetMessageId,
            reaction: message.content.reaction?.emoji,
            fromMe: true,
          },
        };
      default:
        return {
          endpoint: '/send/text',
          payload: {
            number,
            text: message.content.text || '',
            delay: 1000,
            ...quoted,
          },
        };
    }
  }

  private resolveContentType(info: any, message: any): MessageContentType {
    const type = String(
      info?.MediaType || info?.Type || Object.keys(message || {})[0] || '',
    ).toLowerCase();
    if (type.includes('image')) return MessageContentType.IMAGE;
    if (type.includes('audio') || type.includes('ptt')) return MessageContentType.AUDIO;
    if (type.includes('video') || type.includes('ptv')) return MessageContentType.VIDEO;
    if (type.includes('document')) return MessageContentType.DOCUMENT;
    if (type.includes('sticker')) return MessageContentType.STICKER;
    if (type.includes('location')) return MessageContentType.LOCATION;
    if (type.includes('reaction')) return MessageContentType.REACTION;
    if (type.includes('button') || type.includes('list')) return MessageContentType.INTERACTIVE;
    return MessageContentType.TEXT;
  }

  private findMessageNode(message: any, type: MessageContentType): any {
    const keys: Partial<Record<MessageContentType, string[]>> = {
      [MessageContentType.TEXT]: ['extendedTextMessage'],
      [MessageContentType.IMAGE]: ['imageMessage'],
      [MessageContentType.AUDIO]: ['audioMessage'],
      [MessageContentType.VIDEO]: ['videoMessage', 'ptvMessage'],
      [MessageContentType.DOCUMENT]: ['documentMessage'],
      [MessageContentType.STICKER]: ['stickerMessage'],
      [MessageContentType.LOCATION]: ['locationMessage'],
      [MessageContentType.REACTION]: ['reactionMessage'],
    };
    for (const key of keys[type] || []) {
      if (message?.[key]) return message[key];
    }
    return message;
  }

  private extractContent(
    data: any,
    message: any,
    node: any,
    type: MessageContentType,
  ): NormalizedInboundMessage['content'] {
    if (type === MessageContentType.TEXT) {
      return {
        text:
          message?.conversation ||
          message?.extendedTextMessage?.text ||
          node?.text ||
          '',
      };
    }
    if (type === MessageContentType.LOCATION) {
      return {
        latitude: Number(node?.degreesLatitude),
        longitude: Number(node?.degreesLongitude),
        text: node?.name || node?.address,
      };
    }
    if (type === MessageContentType.REACTION) {
      return {
        reaction: {
          emoji: node?.text || '',
          targetMessageId: node?.key?.id || '',
        },
      };
    }

    const mimeType = node?.mimetype || node?.mimeType;
    const base64 = data?.base64 || message?.base64;
    const providerMediaUrl = data?.mediaUrl || message?.mediaUrl;
    const mediaUrl = providerMediaUrl ||
      (base64 ? `data:${mimeType || 'application/octet-stream'};base64,${base64}` : undefined);

    return {
      mediaUrl,
      mimeType,
      fileName: node?.fileName,
      fileSize: this.toNumber(node?.fileLength),
      caption: node?.caption,
    };
  }

  private mapStatus(value: unknown): StatusUpdate['status'] | undefined {
    const status = String(value || '').toLowerCase();
    if (status.includes('read') || status.includes('played')) return 'read';
    if (status.includes('deliver')) return 'delivered';
    if (status.includes('fail') || status.includes('error')) return 'failed';
    if (status.includes('sent') || status.includes('server')) return 'sent';
    return undefined;
  }

  private phoneFromJid(value: unknown): string | undefined {
    const jid = String(value || '');
    if (!jid) return undefined;
    return jid.replace(/@.+$/, '').replace(/:\d+$/, '');
  }

  private toNumber(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }

  private toDate(value: unknown): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'string' && !/^\d+$/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) {
      return new Date(number > 9999999999 ? number : number * 1000);
    }
    return new Date();
  }
}
