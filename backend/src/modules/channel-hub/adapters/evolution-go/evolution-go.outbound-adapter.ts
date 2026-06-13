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
    },
  ): Promise<{ fileUrl: string; mimeType?: string }> {
    const source = hint.mediaId || hint.sourceUrl;
    if (!source) {
      throw new Error(
        `Evolution media resolution requires mediaId or sourceUrl (msg=${hint.externalMessageId})`,
      );
    }
    const buffer = await this.downloadMedia(channel, source);
    const saved = await this.uploads.saveInboundMedia({
      buffer,
      mimeType: hint.mimeType || 'application/octet-stream',
      channelId: channel.id,
      originalFilename: hint.originalFilename ?? null,
    });
    return { fileUrl: saved.url, mimeType: saved.mimeType };
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
