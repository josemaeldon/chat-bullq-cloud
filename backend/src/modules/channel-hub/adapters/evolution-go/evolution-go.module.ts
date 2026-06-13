import { Module, forwardRef } from '@nestjs/common';
import { EvolutionGoHttpClient } from './evolution-go.http-client';
import { EvolutionApiInboundAdapter } from './evolution-api.inbound-adapter';
import { EvolutionApiOutboundAdapter } from './evolution-api.outbound-adapter';
import { EvolutionGoInboundAdapter } from './evolution-go.inbound-adapter';
import { EvolutionGoMessageMapper } from './evolution-go.message-mapper';
import { EvolutionGoOutboundAdapter } from './evolution-go.outbound-adapter';
import { MessagingModule } from '../../../messaging/messaging.module';

@Module({
  imports: [forwardRef(() => MessagingModule)],
  providers: [
    EvolutionGoHttpClient,
    EvolutionGoMessageMapper,
    EvolutionGoInboundAdapter,
    EvolutionGoOutboundAdapter,
    EvolutionApiInboundAdapter,
    EvolutionApiOutboundAdapter,
  ],
  exports: [
    EvolutionGoHttpClient,
    EvolutionGoInboundAdapter,
    EvolutionGoOutboundAdapter,
    EvolutionApiInboundAdapter,
    EvolutionApiOutboundAdapter,
  ],
})
export class EvolutionGoModule {}
