import * as appsync from '@aws-cdk/aws-appsync';
import * as mustache from 'mustache';
import { readFileSync } from 'fs';

export abstract class MappingTemplate extends appsync.MappingTemplate {
  static fromFile(fileName: string, params: any = {}) {
    return super.fromString(mustache.render(readFileSync(fileName, 'utf-8'), params));
  }
}