import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';

interface EvolutionGoConfig {
  baseUrl: string;
  apiKey: string;
  instanceId: string;
  instanceName?: string;
  instanceToken?: string;
  apiVersion?: 'legacy' | 'v2';
}

export interface CreateEvolutionGoInstanceInput {
  baseUrl: string;
  apiKey: string;
  name: string;
  token: string;
  apiVersion?: 'legacy' | 'v2';
  proxy?: {
    host: string;
    address?: string;
    port: string;
    username: string;
    password: string;
    protocol?: string;
  };
}

@Injectable()
export class EvolutionGoHttpClient {
  private readonly logger = new Logger(EvolutionGoHttpClient.name);

  private isV2(config: EvolutionGoConfig): boolean {
    return config.apiVersion === 'v2';
  }

  private resolveInstanceRef(config: EvolutionGoConfig): string {
    return config.instanceName || config.instanceId;
  }

  private config(channel: Channel): EvolutionGoConfig {
    const config = channel.config as unknown as EvolutionGoConfig;
    const hasInstanceRef =
      !!config.instanceId || (config.apiVersion === 'v2' && !!config.instanceName);
    if (!config.baseUrl || !config.apiKey || !hasInstanceRef) {
      throw new Error(
        'Evolution requires baseUrl, apiKey and an instance reference',
      );
    }
    return {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    };
  }

  private createClient(channel: Channel, admin = false): AxiosInstance {
    const config = this.config(channel);
    const apiKey =
      this.isV2(config) || admin
        ? config.apiKey
        : config.instanceToken || config.apiKey;
    return axios.create({
      baseURL: config.baseUrl,
      headers: {
        apikey: apiKey,
        ...(this.isV2(config) ? {} : { instanceId: config.instanceId }),
      },
      timeout: 30000,
    });
  }

  async createInstance(input: CreateEvolutionGoInstanceInput): Promise<any> {
    try {
      const baseUrl = input.baseUrl.replace(/\/+$/, '');
      if (input.apiVersion === 'v2') {
        const response = await axios.post(
          `${baseUrl}/instance/create`,
          {
            instanceName: input.name,
            token: input.token,
            qrcode: true,
            ...(input.proxy
              ? {
                  proxyHost: input.proxy.host,
                  proxyPort: input.proxy.port,
                  proxyProtocol: input.proxy.protocol,
                  proxyUsername: input.proxy.username,
                  proxyPassword: input.proxy.password,
                }
              : {}),
          },
          {
            headers: { apikey: input.apiKey },
            timeout: 30000,
          },
        );
        return response.data?.instance ?? response.data?.data ?? response.data;
      }

      const response = await axios.post(
        `${baseUrl}/instance/create`,
        {
          name: input.name,
          token: input.token,
          ...(input.proxy
            ? {
                proxy: {
                  ...input.proxy,
                  address: input.proxy.address || input.proxy.host,
                },
              }
            : {}),
        },
        {
          headers: { apikey: input.apiKey },
          timeout: 30000,
        },
      );
      return response.data?.data ?? response.data?.instance ?? response.data;
    } catch (error: any) {
      this.logError('/instance/create', error);
      throw error;
    }
  }

  async sendRequest(
    channel: Channel,
    endpoint: string,
    payload: Record<string, any>,
  ): Promise<any> {
    try {
      const response = await this.createClient(channel).post(endpoint, payload);
      return response.data;
    } catch (error: any) {
      this.logError(endpoint, error);
      throw error;
    }
  }

  async getInstanceInfo(channel: Channel): Promise<any> {
    const config = this.config(channel);
    try {
      if (this.isV2(config)) {
        const response = await this.createClient(channel, true).get(
          '/instance/fetchInstances',
          {
            params: {
              ...(config.instanceName ? { instanceName: config.instanceName } : {}),
              ...(config.instanceId ? { instanceId: config.instanceId } : {}),
            },
          },
        );
        const items = Array.isArray(response.data)
          ? response.data
          : response.data?.response;
        const first = Array.isArray(items) ? items[0] : items;
        return first?.instance ?? first ?? response.data;
      }

      const response = await this.createClient(channel, true).get(
        `/instance/info/${encodeURIComponent(config.instanceId)}`,
      );
      return response.data?.data ?? response.data;
    } catch (error: any) {
      this.logError('/instance/info/:instanceId', error);
      throw error;
    }
  }

  async getInstanceStatus(channel: Channel): Promise<any> {
    const config = this.config(channel);
    try {
      if (this.isV2(config)) {
        const response = await this.createClient(channel, true).get(
          `/instance/connectionState/${encodeURIComponent(
            this.resolveInstanceRef(config),
          )}`,
        );
        return response.data?.instance ?? response.data?.data ?? response.data;
      }

      const response = await this.createClient(channel).get('/instance/status');
      return response.data?.data ?? response.data;
    } catch (error: any) {
      this.logError('/instance/status', error);
      throw error;
    }
  }

  async getInstanceQr(channel: Channel): Promise<{
    qrCode?: string;
    code?: string;
    pairingCode?: string;
  }> {
    const config = this.config(channel);
    try {
      const response = this.isV2(config)
        ? await this.createClient(channel, true).get(
            `/instance/connect/${encodeURIComponent(
              this.resolveInstanceRef(config),
            )}`,
          )
        : await this.createClient(channel).get('/instance/qr');
      const data = response.data?.data ?? response.data;
      return {
        qrCode: data?.Qrcode || data?.qrcode || data?.qrCode,
        code: data?.Code || data?.code,
        pairingCode: data?.pairingCode,
      };
    } catch (error: any) {
      this.logError('/instance/qr', error);
      throw error;
    }
  }

  async configureWebhook(channel: Channel, webhookUrl: string): Promise<any> {
    const config = this.config(channel);
    if (this.isV2(config)) {
      try {
        const response = await this.createClient(channel, true).post(
          `/webhook/set/${encodeURIComponent(this.resolveInstanceRef(config))}`,
          {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: true,
            webhookBase64: true,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
          },
        );
        return response.data;
      } catch (error: any) {
        this.logError('/webhook/set/:instance', error);
        throw error;
      }
    }

    return this.sendRequest(channel, '/instance/connect', {
      webhookUrl,
      subscribe: ['MESSAGE', 'SEND_MESSAGE', 'READ_RECEIPT', 'CONNECTION'],
      immediate: true,
    });
  }

  async getMediaBuffer(mediaUrl: string): Promise<Buffer> {
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
    });
    return Buffer.from(response.data);
  }

  async deleteMessage(
    channel: Channel,
    externalMessageId: string,
    contactExternalId?: string,
  ): Promise<void> {
    const config = this.config(channel);
    if (!contactExternalId) {
      throw new Error('Evolution GO requires the chat id to delete a message');
    }
    if (this.isV2(config)) {
      await this.createClient(channel, true).delete(
        `/chat/deleteMessageForEveryone/${encodeURIComponent(
          this.resolveInstanceRef(config),
        )}`,
        {
          data: {
            id: externalMessageId,
            remoteJid: contactExternalId,
            fromMe: true,
          },
        },
      );
      return;
    }
    await this.sendRequest(channel, '/message/delete', {
      chat: contactExternalId,
      messageId: externalMessageId,
    });
  }

  private logError(endpoint: string, error: any) {
    const detail =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message;
    this.logger.error(`Evolution GO API error: ${endpoint} - ${detail}`);
  }
}
