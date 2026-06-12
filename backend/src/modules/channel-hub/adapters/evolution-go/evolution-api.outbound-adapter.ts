import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { EvolutionGoOutboundAdapter } from './evolution-go.outbound-adapter';

@Injectable()
export class EvolutionApiOutboundAdapter extends EvolutionGoOutboundAdapter {
  readonly channelType = ChannelType.WHATSAPP_EVOLUTION_API;
}
