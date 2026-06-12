import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { EvolutionGoInboundAdapter } from './evolution-go.inbound-adapter';

@Injectable()
export class EvolutionApiInboundAdapter extends EvolutionGoInboundAdapter {
  readonly channelType = ChannelType.WHATSAPP_EVOLUTION_API;
}
