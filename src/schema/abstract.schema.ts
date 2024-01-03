/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { InactivationReason } from '../enum/inactivation-reason.enum';

export type AbstractDocument = AbstractSchema & Document;

export abstract class AbstractSchema {
  @Prop({ required: true })
  active: boolean;

  @Prop({ required: false })
  inactivationDate?: Date;

  @Prop({ required: false })
  inactivationReason?: InactivationReason;

  @Prop({ required: false, type: Object })
  metadata?: object;
}
