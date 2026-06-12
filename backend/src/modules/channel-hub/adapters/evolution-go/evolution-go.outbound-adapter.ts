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

@Injectable()
export class EvolutionGoOutboundAdapter implements OutboundChannelPort {
  readonly channelType = ChannelType.WHATSAPP_EVOLUTION_GO;
  private readonly logger = new Logger(EvolutionGoOutboundAdapter.name);

  constructor(
    private readonly mapper: EvolutionGoMessageMapper,
    private readonly httpClient: EvolutionGoHttpClient,
  ) {}

  async sendMessage(
    channel: Channel,
    contactExternalId: string,
    message: NormalizedOutboundMessage,
  ): Promise<SendResult> {
    const { endpoint, payload } = this.mapper.denormalize(message, contactExternalId);
    const response = await this.httpClient.sendRequest(channel, endpoint, payload);
    return {
      externalId:
        response?.data?.Info?.ID ||
        response?.data?.info?.id ||
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
    try {
      await this.httpClient.sendRequest(channel, '/message/presence', {
        number: contactExternalId.replace(/@.+$/, ''),
        state: 'composing',
        isAudio: false,
      });
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
