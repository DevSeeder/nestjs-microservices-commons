import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';

import { ClientAuthService } from '@devseeder/nestjs-microservices-core';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [
    { provide: ClientAuthService.name, useClass: ClientAuthService },
    ConfigService,
  ],
  exports: [ClientAuthService.name, ConfigService],
})
export class AuthHttpModule {}
