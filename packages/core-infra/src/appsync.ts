import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as mustache from 'mustache';
import { readFileSync } from 'fs';

export abstract class MappingTemplate extends appsync.MappingTemplate {
  static fromFile(fileName: string, params: any = undefined) {
    if (params == null) {
      return super.fromFile(fileName);
    } else {
      return super.fromString(mustache.render(readFileSync(fileName, 'utf-8'), params));
    }
  }
}

export class ElasticsearchDataSource extends appsync.BackedDataSource {
  constructor(scope: cdk.Construct, id: string, domain: es.IDomain, props: appsync.BackedDataSourceProps) {
    super(scope, id, props, {
      type: 'AMAZON_ELASTICSEARCH',
      elasticsearchConfig: {
        awsRegion: cdk.Fn.select(3, cdk.Fn.split(':', domain.domainArn)),
        endpoint: `https://${domain.domainEndpoint}`,
      }
    });
    domain.grantReadWrite(this);
  }
}

export class GraphqlApi extends appsync.GraphqlApi {
  public addElasticSearchDataSource(id: string, domain: es.IDomain): ElasticsearchDataSource {
    return new ElasticsearchDataSource(this, id, domain, { api: this });
  }
}