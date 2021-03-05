import * as cdk from '@aws-cdk/core';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as source from '@aws-cdk/aws-lambda-event-sources';
import * as core from './index';
import { join } from 'path';

export interface DynamoDBStreamElasticSearchProps {
  domain: es.IDomain;
  table: dynamodb.ITable;
  partitionKey: dynamodb.Attribute;
};

export class DynamoDBIndexElasticSearch extends cdk.Construct {
  public readonly streamingFunction: lambda.Function;

  constructor(scope: cdk.Construct, id: string, props: DynamoDBStreamElasticSearchProps) {
    super(scope, id);

    this.streamingFunction = new core.Function(this, `${id}StreamLambda`, {
      entry: join(__dirname, 'functions/streamTable.ts'),
      handler: 'handler',
      environment: {
        'ES_DOMAIN': props.domain.domainEndpoint,
        'ES_INDEX': props.table.tableName,
        'PK': props.partitionKey.name
      }
    });
    this.streamingFunction.addEventSource(new source.DynamoEventSource(props.table, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON
    }));
    props.domain.grantReadWrite(this.streamingFunction);
  }
}