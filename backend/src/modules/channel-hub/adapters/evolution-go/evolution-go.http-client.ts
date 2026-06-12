import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';

interface EvolutionGoConfig {
  baseUrl: string;
  apiKey: string;
  instanceId: string;
  instanceToken?: string;
}

@Injectable()
export class EvolutionGoHttpClient {
  private readonly logger = new Logger(EvolutionGoHttpClient.name);

  private config(channel: Channel): EvolutionGoConfig {
    const config = channel.config as unknown as EvolutionGoConfig;
    if (!config.baseUrl || !config.apiKey || !config.instanceId) {
      throw new Error(
        'Evolution GO requires baseUrl, apiKey and instanceId',
      );
    }
    return {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    };
  }

  private createClient(channel: Channel, admin = false): AxiosInstance {
    const config = this.config(channel);
    const apiKey = admin ? config.apiKey : config.instanceToken || config.apiKey;
    return axios.create({
      baseURL: config.baseUrl,
      headers: {
        apikey: apiKey,
        instanceId: config.instanceId,
      },
      timeout: 30000,
    });
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
    try {
      const response = await this.createClient(channel).get('/instance/status');
      return response.data?.data ?? response.data;
    } catch (error: any) {
      this.logError('/instance/status', error);
      throw error;
    }
  }

  async configureWebhook(channel: Channel, webhookUrl: string): Promise<any> {
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
    if (!contactExternalId) {
      throw new Error('Evolution GO requires the chat id to delete a message');
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
