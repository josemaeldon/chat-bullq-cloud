import { Module } from '@nestjs/common';
import { EvolutionGoHttpClient } from './evolution-go.http-client';
import { EvolutionGoInboundAdapter } from './evolution-go.inbound-adapter';
import { EvolutionGoMessageMapper } from './evolution-go.message-mapper';
import { EvolutionGoOutboundAdapter } from './evolution-go.outbound-adapter';

@Module({
  providers: [
    EvolutionGoHttpClient,
    EvolutionGoMessageMapper,
    EvolutionGoInboundAdapter,
    EvolutionGoOutboundAdapter,
  ],
  exports: [
    EvolutionGoHttpClient,
    EvolutionGoInboundAdapter,
    EvolutionGoOutboundAdapter,
  ],
})
export class EvolutionGoModule {}
