/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AbstractDocument = AbstractSchema & Document;

export abstract class AbstractSchema {
  @Prop({ required: true })
  active: boolean;

  @Prop({ required: false })
  inactivationDate?: Date;
}
