import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';

import { ClientAuthService } from '@devseeder/nestjs-microservices-core';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [ClientAuthService, ConfigService],
  exports: [ClientAuthService, ConfigService],
})
export class AuthHttpModule {}
