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
  normalizeInbound(
    event: any,
    channelType: ChannelType = ChannelType.WHATSAPP_EVOLUTION_GO,
  ): NormalizedInboundMessage | null {
    const data = event?.data ?? {};
    const info = data?.Info ?? data?.info;
    const key = data?.key;
    const message = data?.Message ?? data?.message;
    const externalId = String(info?.ID || key?.id || '');
    if (!message || !externalId) return null;

    const chat = String(
      info?.Chat || info?.Sender || key?.remoteJid || key?.participant || '',
    );
    if (!chat) return null;

    const isGroup = info?.IsGroup === true || chat.endsWith('@g.us');
    const isEcho = info?.IsFromMe === true || key?.fromMe === true;
    const type = this.resolveContentType(info ?? data, message);
    const nested = this.findMessageNode(message, type);
    const contextInfo = nested?.contextInfo || message?.contextInfo;
    const contactName = isEcho
      ? undefined
      : info?.PushName || data?.pushName || undefined;

    const normalized: NormalizedInboundMessage = {
      externalMessageId: externalId,
      externalContactId: chat,
      contactName,
      contactPhone: isGroup ? undefined : this.phoneFromJid(chat),
      channelType,
      timestamp: this.toDate(info?.Timestamp || data?.messageTimestamp || event?.date_time),
      type,
      content: this.extractContent(data, message, nested, type),
      isForwarded: !!contextInfo?.isForwarded,
      isGroup,
      isEcho,
      senderName: isGroup
        ? info?.PushName ||
          data?.pushName ||
          this.phoneFromJid(info?.Sender || key?.participant)
        : undefined,
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
    const v2Entries = Array.isArray(data) ? data : [data];
    const v2Statuses = v2Entries
      .map((entry) => {
        const id = entry?.key?.id;
        const status = this.mapStatus(entry?.status || entry?.update?.status);
        if (!id || !status) return null;
        return {
          externalMessageId: String(id),
          status,
          timestamp: this.toDate(
            entry?.messageTimestamp || event?.date_time,
          ),
        };
      })
      .filter((entry): entry is StatusUpdate => Boolean(entry));
    if (v2Statuses.length > 0) return v2Statuses;

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
    apiVersion: 'legacy' | 'v2' = 'legacy',
  ): { endpoint: string; payload: Record<string, any> } {
    const number = contactExternalId.replace(/@.+$/, '');
    const replyId = message.replyTo?.externalMessageId;
    const quoted =
      apiVersion === 'v2'
        ? replyId
          ? {
              quoted: {
                key: { id: replyId },
                message: { conversation: '' },
              },
            }
          : {}
        : replyId
          ? { quoted: { messageId: replyId } }
          : {};

    switch (message.type) {
      case MessageContentType.IMAGE:
      case MessageContentType.AUDIO:
      case MessageContentType.VIDEO:
      case MessageContentType.DOCUMENT:
        return {
          endpoint: apiVersion === 'v2' ? '/message/sendMedia' : '/send/media',
          payload: {
            number,
            ...(apiVersion === 'v2'
              ? {
                  media: message.content.mediaUrl,
                  mediatype: message.type.toLowerCase(),
                  mimetype: message.content.mimeType,
                  caption: message.content.caption || '',
                  fileName: message.content.fileName || '',
                }
              : {
                  url: message.content.mediaUrl,
                  type: message.type.toLowerCase(),
                  caption: message.content.caption || '',
                  filename: message.content.fileName || '',
                }),
            ...quoted,
          },
        };
      case MessageContentType.STICKER:
        return {
          endpoint: apiVersion === 'v2' ? '/message/sendSticker' : '/send/sticker',
          payload: {
            number,
            sticker: message.content.mediaUrl,
            ...quoted,
          },
        };
      case MessageContentType.LOCATION:
        return {
          endpoint: apiVersion === 'v2' ? '/message/sendLocation' : '/send/location',
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
          endpoint: apiVersion === 'v2' ? '/message/sendReaction' : '/message/react',
          payload: {
            number,
            ...(apiVersion === 'v2'
              ? {
                  reactionMessage: {
                    key: { id: message.content.reaction?.targetMessageId },
                    reaction: message.content.reaction?.emoji,
                  },
                }
              : {
                  id: message.content.reaction?.targetMessageId,
                  reaction: message.content.reaction?.emoji,
                  fromMe: true,
                }),
          },
        };
      default:
        return {
          endpoint: apiVersion === 'v2' ? '/message/sendText' : '/send/text',
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

    const detected = this.detectContentTypeFromMessage(message);
    if (detected) return detected;

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

    const nested = message?.message;
    if (nested && nested !== message) {
      const nestedNode = this.findMessageNode(nested, type);
      if (nestedNode) return nestedNode;
    }

    return message;
  }

  private detectContentTypeFromMessage(message: any): MessageContentType | null {
    const priority: Array<[MessageContentType, string[]]> = [
      [MessageContentType.IMAGE, ['imageMessage']],
      [MessageContentType.AUDIO, ['audioMessage']],
      [MessageContentType.VIDEO, ['videoMessage', 'ptvMessage']],
      [MessageContentType.DOCUMENT, ['documentMessage']],
      [MessageContentType.STICKER, ['stickerMessage']],
      [MessageContentType.LOCATION, ['locationMessage']],
      [MessageContentType.REACTION, ['reactionMessage']],
      [MessageContentType.TEXT, ['extendedTextMessage']],
    ];

    for (const [type, keys] of priority) {
      if (this.hasAnyMessageNode(message, keys, new Set<any>())) {
        return type;
      }
    }
    return null;
  }

  private hasAnyMessageNode(
    value: any,
    keys: string[],
    seen: Set<any>,
  ): boolean {
    if (!value || typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);

    for (const key of keys) {
      if (value[key]) return true;
    }

    for (const child of Object.values(value)) {
      if (this.hasAnyMessageNode(child, keys, seen)) return true;
    }

    return false;
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
    const providerMediaUrl =
      data?.mediaUrl ||
      message?.mediaUrl ||
      node?.mediaUrl ||
      node?.url ||
      node?.URL;
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
