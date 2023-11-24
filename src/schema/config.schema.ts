/* eslint-disable @typescript-eslint/no-unused-vars */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AbstractSchema } from './abstract.schema';

export type ConfigDocument = AbstractConfig & Document;

export abstract class AbstractConfig extends AbstractSchema {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  key: string;
}
