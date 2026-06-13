import { Injectable, Logger } from '@nestjs/common';
import { Channel, ChannelType } from '@prisma/client';
import { OutboundChannelPort } from '../../ports/outbound-channel.port';
import {
  NormalizedOutboundMessage,
  RateLimitConfig,
  SendResult,
} from '../../ports/types';
import { EvolutionGoHttpClient } from './evolution-go.http-client';
import { EvolutionGoMessageMapper } from './evolution-go.message-mapper';
import { UploadsService } from '../../../messaging/messages/uploads.service';

@Injectable()
export class EvolutionGoOutboundAdapter implements OutboundChannelPort {
  readonly channelType: ChannelType = ChannelType.WHATSAPP_EVOLUTION_GO;
  private readonly logger = new Logger(EvolutionGoOutboundAdapter.name);

  constructor(
    private readonly mapper: EvolutionGoMessageMapper,
    private readonly httpClient: EvolutionGoHttpClient,
    private readonly uploads: UploadsService,
  ) {}

  async sendMessage(
    channel: Channel,
    contactExternalId: string,
    message: NormalizedOutboundMessage,
  ): Promise<SendResult> {
    const apiVersion =
      ((channel.config as Record<string, any>)?.apiVersion as
        | 'legacy'
        | 'v2'
        | undefined) || 'legacy';
    const { endpoint, payload } = this.mapper.denormalize(
      message,
      contactExternalId,
      apiVersion,
    );
    const response = await this.httpClient.sendRequest(channel, endpoint, payload);
    return {
      externalId:
        response?.data?.Info?.ID ||
        response?.data?.info?.id ||
        response?.key?.id ||
        response?.Info?.ID ||
        response?.id ||
        '',
      providerResponse: response,
    };
  }

  async sendTypingIndicator(
    channel: Channel,
    contactExternalId: string,
  ): Promise<void> {
    const config = (channel.config as Record<string, any>) || {};
    try {
      if (config.apiVersion === 'v2') {
        await this.httpClient.sendRequest(
          channel,
          `/chat/sendPresence/${encodeURIComponent(
            String(config.instanceName || config.instanceId || ''),
          )}`,
          {
            number: contactExternalId.replace(/@.+$/, ''),
            options: {
              delay: 1200,
              number: contactExternalId.replace(/@.+$/, ''),
            },
          },
        );
      } else {
        await this.httpClient.sendRequest(channel, '/message/presence', {
          number: contactExternalId.replace(/@.+$/, ''),
          state: 'composing',
          isAudio: false,
        });
      }
    } catch (error: any) {
      this.logger.warn(`Evolution GO typing indicator failed: ${error.message}`);
    }
  }

  async getMediaUrl(_channel: Channel, mediaId: string): Promise<string> {
    return mediaId;
  }

  async downloadMedia(_channel: Channel, mediaId: string): Promise<Buffer> {
    return this.httpClient.getMediaBuffer(mediaId);
  }

  async resolveInboundMediaUrl(
    channel: Channel,
    hint: {
      externalMessageId: string;
      mediaId?: string;
      sourceUrl?: string;
      mimeType?: string;
      originalFilename?: string;
      rawPayload?: unknown;
    },
  ): Promise<{ fileUrl: string; mimeType?: string }> {
    const source = hint.sourceUrl || hint.mediaId;
    const inferredFromPayload = this.extractMediaFromPayload(hint.rawPayload);
    const candidate = source || inferredFromPayload?.source;
    const decoded = candidate?.startsWith('data:')
      ? this.decodeDataUrl(candidate)
      : null;

    const buffer =
      decoded?.buffer ??
      (candidate && /^https?:\/\//i.test(candidate)
        ? await this.downloadMedia(channel, candidate)
        : inferredFromPayload?.buffer);

    if (!buffer) {
      throw new Error(
        `Evolution media resolution failed (msg=${hint.externalMessageId})`,
      );
    }

    const mimeType =
      hint.mimeType ||
      decoded?.mimeType ||
      inferredFromPayload?.mimeType ||
      this.mimeTypeFromSource(candidate || '', hint.originalFilename) ||
      'application/octet-stream';
    const saved = await this.uploads.saveInboundMedia({
      buffer,
      mimeType,
      channelId: channel.id,
      originalFilename: hint.originalFilename ?? null,
    });
    return { fileUrl: saved.url, mimeType: saved.mimeType };
  }

  private decodeDataUrl(dataUrl: string): { buffer: Buffer; mimeType?: string } {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
    if (!match) {
      throw new Error('Invalid Evolution data URL');
    }
    return {
      buffer: Buffer.from(match[2], 'base64'),
      mimeType: match[1],
    };
  }

  private extractMediaFromPayload(
    rawPayload: unknown,
  ): { buffer?: Buffer; source?: string; mimeType?: string } | undefined {
    const seen = new Set<any>();
    const walk = (value: any): { buffer?: Buffer; source?: string; mimeType?: string } | undefined => {
      if (!value || typeof value !== 'object' || seen.has(value)) return undefined;
      seen.add(value);

      const mimeType =
        this.mimeTypeFromSource(String(value?.url || value?.mediaUrl || value?.fileUrl || value?.path || ''), value?.fileName) ||
        value?.mimetype ||
        value?.mimeType ||
        undefined;

      const direct = value?.base64 || value?.data;
      if (typeof direct === 'string' && direct.trim()) {
        return {
          buffer: this.decodeBase64MaybeDataUrl(direct).buffer,
          mimeType: this.decodeBase64MaybeDataUrl(direct).mimeType || mimeType,
        };
      }

      const source = value?.mediaUrl || value?.url || value?.fileUrl || value?.path;
      if (typeof source === 'string' && source.trim()) {
        return { source, mimeType };
      }

      for (const child of Object.values(value)) {
        const found = walk(child);
        if (found) return found;
      }
      return undefined;
    };

    return walk(rawPayload);
  }

  private decodeBase64MaybeDataUrl(
    value: string,
  ): { buffer: Buffer; mimeType?: string } {
    const trimmed = value.trim();
    if (trimmed.startsWith('data:')) {
      return this.decodeDataUrl(trimmed);
    }
    return { buffer: Buffer.from(trimmed, 'base64') };
  }

  private mimeTypeFromSource(
    source: string,
    originalFilename?: string | null,
  ): string | undefined {
    const candidate = (originalFilename || source).split('?')[0].split('#')[0];
    const ext = candidate.includes('.')
      ? candidate.slice(candidate.lastIndexOf('.')).toLowerCase()
      : '';
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.heic':
        return 'image/heic';
      case '.mp3':
      case '.mpeg':
      case '.mpga':
        return 'audio/mpeg';
      case '.ogg':
      case '.oga':
        return 'audio/ogg';
      case '.m4a':
        return 'audio/mp4';
      case '.wav':
        return 'audio/wav';
      case '.webm':
        return 'audio/webm';
      case '.mp4':
        return 'video/mp4';
      case '.mov':
        return 'video/quicktime';
      case '.3gp':
        return 'video/3gpp';
      case '.pdf':
        return 'application/pdf';
      case '.zip':
        return 'application/zip';
      case '.txt':
        return 'text/plain';
      case '.csv':
        return 'text/csv';
      default:
        return undefined;
    }
  }

  async deleteMessage(
    channel: Channel,
    externalMessageId: string,
    contactExternalId?: string,
  ): Promise<void> {
    await this.httpClient.deleteMessage(
      channel,
      externalMessageId,
      contactExternalId,
    );
  }

  getRateLimits(): RateLimitConfig {
    return { maxPerSecond: 2, maxPerMinute: 60, windowMs: 60000 };
  }
}
