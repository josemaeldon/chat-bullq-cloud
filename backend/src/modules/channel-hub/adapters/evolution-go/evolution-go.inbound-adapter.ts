import { Injectable, Logger } from '@nestjs/common';
import { Channel, ChannelType } from '@prisma/client';
import * as crypto from 'crypto';
import {
  ChannelLocator,
  InboundChannelPort,
} from '../../ports/inbound-channel.port';
import { VerificationResponse, WebhookParseResult } from '../../ports/types';
import { EvolutionGoMessageMapper } from './evolution-go.message-mapper';

@Injectable()
export class EvolutionGoInboundAdapter implements InboundChannelPort {
  readonly channelType: ChannelType = ChannelType.WHATSAPP_EVOLUTION_GO;
  private readonly logger = new Logger(EvolutionGoInboundAdapter.name);

  constructor(private readonly mapper: EvolutionGoMessageMapper) {}

  extractLocators(
    payload: unknown,
    headers: Record<string, string>,
  ): ChannelLocator[] {
    const event = (payload || {}) as Record<string, any>;
    return [{
      instanceName: String(
        event.instanceName || event.instance?.name || event.instance || '',
      ) || undefined,
      instanceId: String(
        event.instanceId || event.instance?.id || headers.instanceid || '',
      ) || undefined,
      token: String(
        event.instanceToken ||
          event.instance?.token ||
          event.apikey ||
          headers.apikey ||
          '',
      ) || undefined,
    }];
  }

  matchesChannel(channel: Channel, locator: ChannelLocator): boolean {
    const config = channel.config as Record<string, any>;
    if (config.apiVersion === 'v2') {
      if (locator.instanceName && config.instanceName) {
        return String(config.instanceName) === String(locator.instanceName);
      }
      if (locator.instanceId && config.instanceId) {
        return String(config.instanceId) === String(locator.instanceId);
      }
      if (locator.token && config.apiKey) {
        return this.safeEqual(String(config.apiKey), String(locator.token));
      }
      return false;
    }
    if (locator.instanceId && config.instanceId) {
      return String(config.instanceId) === String(locator.instanceId);
    }
    if (locator.token && config.instanceToken) {
      return this.safeEqual(String(config.instanceToken), String(locator.token));
    }
    return false;
  }

  validateWebhook(
    headers: Record<string, string>,
    rawBody: Buffer,
    webhookSecret?: string,
    channel?: Channel,
  ): boolean {
    const config = (channel?.config || {}) as Record<string, any>;
    const payloadToken = this.bodyToken(rawBody);
    const candidate = payloadToken || headers.apikey;
    const expected =
      webhookSecret ||
      (config.apiVersion === 'v2' ? config.apiKey : config.instanceToken);
    return !!candidate && !!expected && this.safeEqual(String(expected), String(candidate));
  }

  parseWebhook(payload: unknown): WebhookParseResult {
    const result: WebhookParseResult = { messages: [], statuses: [], errors: [] };
    try {
      const event = payload as any;
      const eventType = String(event?.event || event?.EventType || '')
        .toUpperCase()
        .replace(/\./g, '_');
      if (
        eventType === 'MESSAGE' ||
        eventType === 'SEND_MESSAGE' ||
        eventType === 'MESSAGES_UPSERT'
      ) {
        const message = this.mapper.normalizeInbound(event, this.channelType);
        if (message) result.messages.push(message);
      } else if (
        eventType === 'RECEIPT' ||
        eventType === 'READ_RECEIPT' ||
        eventType === 'MESSAGES_UPDATE'
      ) {
        result.statuses.push(...this.mapper.normalizeStatuses(event));
      }
    } catch (error: any) {
      this.logger.error(`Failed to parse Evolution GO webhook: ${error.message}`);
      result.errors.push({
        code: 'PARSE_ERROR',
        message: error.message,
        rawData: payload,
      });
    }
    return result;
  }

  handleVerification(): VerificationResponse {
    return { statusCode: 200, body: 'OK' };
  }

  private bodyToken(rawBody: Buffer): string | undefined {
    try {
      const body = JSON.parse(rawBody.toString('utf8'));
      return body?.instanceToken || body?.instance?.token || body?.apikey;
    } catch {
      return undefined;
    }
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
