import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as cdk from '@aws-cdk/core';
import * as cr from '@aws-cdk/custom-resources';
import { DynamoDBTableGSIResourceProperties } from './functions/addGSI';
import { Function } from './index';
import { join } from 'path';

export interface DynamoGSIResourceProps {
  table: dynamodb.ITable;
  partitionKey: dynamodb.Attribute;
  sortKey?: dynamodb.Attribute;
  gsi: dynamodb.GlobalSecondaryIndexProps;
};

export class GlobalSecondaryIndex extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: DynamoGSIResourceProps) {
    super(scope, id);

    const onEvent = new Function(this, 'DynamoDBTableGSIResourceOnEventHandler', {
      entry: join(__dirname, 'functions/addGSI.ts'),
      handler: 'onEvent',
      timeout: cdk.Duration.minutes(15),
      bundling: {
        nodeModules: []
      }
    });
    props.table.grantFullAccess(onEvent);

    const isComplete = new Function(this, 'DynamoDBTableGSIResourceIsCompleteHandler', {
      entry: join(__dirname, 'functions/addGSI.ts'),
      handler: 'isComplete',
      timeout: cdk.Duration.minutes(15),
      bundling: {
        nodeModules: []
      }
    });

    const provider = new cr.Provider(this, 'DynamoDBTableGSIResourceProvider', {
      onEventHandler: onEvent,
      isCompleteHandler: isComplete
    });

    const resourceProperties: DynamoDBTableGSIResourceProperties = {
      ServiceToken: provider.serviceToken,
      tableName: props.table.tableName,
      indexName: props.gsi.indexName,
      primaryPartitionKeyName: props.partitionKey.name,
      primaryPartitionKeyType: props.partitionKey.type.valueOf(),
      primarySortKeyName: props.sortKey?.name,
      primarySortKeyType: props.sortKey?.type.valueOf(),
      gsiPartitionKeyName: props.gsi.partitionKey.name,
      gsiPartitionKeyType: props.gsi.partitionKey.type.valueOf(),
      gsiSortKeyName: props.gsi.sortKey?.name,
      gsiSortKeyType: props.gsi.sortKey?.type.valueOf(),
      gsiReadCapacity: props.gsi.readCapacity,
      gsiWriteCapacity: props.gsi.writeCapacity
    }

    new cdk.CustomResource(this, id, {
      resourceType: 'Custom::DynamoDBTableGSIResource',
      serviceToken: provider.serviceToken,
      properties: resourceProperties
    });
  }
}

export class Table extends dynamodb.Table {
  private readonly partitionKey: dynamodb.Attribute;
  private readonly gsis = new Array<GlobalSecondaryIndex>();

  constructor(scope: cdk.Construct, id: string, props: dynamodb.TableProps) {
    super(scope, id, props);
    this.partitionKey = props.partitionKey;
  }

  addGlobalSecondaryIndex(props: dynamodb.GlobalSecondaryIndexProps) {
    const gsi = new GlobalSecondaryIndex(this, props.indexName, {
      table: this,
      partitionKey: this.partitionKey,
      gsi: props
    });
    if (this.gsis.length > 0) {
      gsi.node.addDependency(this.gsis[this.gsis.length - 1]);
    }
    this.gsis.push(gsi);
  }

  protected get hasIndex(): boolean {
    return this.gsis.length > 0 || super.hasIndex;
  }
}
