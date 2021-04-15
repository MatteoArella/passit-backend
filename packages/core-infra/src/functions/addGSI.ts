import { DynamoDB } from 'aws-sdk';
import * as lambda from 'aws-lambda';

export interface DynamoDBTableGSIResourceProperties {
  tableName: string;
  primaryPartitionKeyName: string;
  primaryPartitionKeyType: string;
  primarySortKeyName?: string;
  primarySortKeyType?: string;
  indexName: string;
  gsiPartitionKeyName: string;
  gsiPartitionKeyType: string;
  gsiSortKeyName?: string;
  gsiSortKeyType?: string;
  gsiReadCapacity?: number;
  gsiWriteCapacity?: number;

  ServiceToken: string;

  [key: string]: string | number | undefined;
}

interface CloudFormationCustomResourceEventResponse {
  PhysicalResourceId?: string;
  Data?: { [name: string]: any };
};

interface CloudFormationCustomResourceOnCompleteEventResponse {
  IsComplete: boolean;
  Data?: { [name: string]: any };
}

type DynamoDBTableGSIResourceEventResponse = CloudFormationCustomResourceEventResponse & CloudFormationCustomResourceOnCompleteEventResponse;
type DynamoDBTableGSIResourceCompleteEvent = CloudFormationCustomResourceEventResponse & CloudFormationCustomResourceOnCompleteEventResponse;
type DynamoDBTableGSIResourceCompleteEventResponse = CloudFormationCustomResourceOnCompleteEventResponse;

const ddb = new DynamoDB();

const sleep = async (seconds: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
};

const checkTableStatus = async (tableName: string): Promise<boolean> => {
  try {
    const { Table } = await ddb.describeTable({ TableName: tableName }).promise();
    return Table ? Table.TableStatus === 'ACTIVE' : false;
  } catch (err) {
    console.debug(`Table status not returned ${JSON.stringify(err, null, 2)}`);
    return false;
  }
};

const checkGSIStatus = async (tableName: string): Promise<boolean> => {
  try {
    const { Table } = await ddb.describeTable({ TableName: tableName }).promise();
    if (Table?.GlobalSecondaryIndexes) {
      return Table.GlobalSecondaryIndexes.every(gsi => gsi.IndexStatus === 'ACTIVE');
    } else {
      console.debug('No GSIs present, continuing...');
      return true;
    }
  } catch (err) {
    console.debug(`Failed to get GSIs ${JSON.stringify(err, null, 2)}`);
    return false;
  }
};

const tableActive = async (tableName: string, waitSeconds: number = 15) => {
  var isTableActive = false;
  var isGsiActive = false;
  var delay = 0;

  // check that the table is active
  while (!isTableActive) {
    if (delay > waitSeconds) {
      delay = waitSeconds;
    }
    const expWait = Math.floor(Math.pow(waitSeconds, delay / waitSeconds));
    console.debug(`Table '${tableName}' is not active, waiting '${expWait}' seconds to poll again`);
    await sleep(expWait);
    isTableActive = await checkTableStatus(tableName);
    delay++;
  }
  console.debug(`Table '${tableName}' is active`);

  // check that all GSIs are active
  delay = 0;
  while (!isGsiActive) {
    if (delay > waitSeconds) {
      delay = waitSeconds;
    }
    const expWait = Math.floor(Math.pow(waitSeconds, delay / waitSeconds));
    console.debug(`Table '${tableName}' GSIs are not active, waiting '${expWait}' seconds to poll again`);
    await sleep(expWait);
    isGsiActive = await checkGSIStatus(tableName);
    delay++;
  }
  console.debug(`Table '${tableName}' GSIs are active`);
};

const createGSI = async (props: DynamoDBTableGSIResourceProperties) => {
  const attributeDefinitions: DynamoDB.AttributeDefinitions = [
    {
      AttributeName: props.primaryPartitionKeyName,
      AttributeType: props.primaryPartitionKeyType
    },
    {
      AttributeName: props.gsiPartitionKeyName,
      AttributeType: props.gsiPartitionKeyType
    }
  ];
  const keySchema: DynamoDB.KeySchema = [
    {
      AttributeName: props.gsiPartitionKeyName,
      KeyType: 'HASH'
    }
  ];
  
  if (props.gsiSortKeyName && props.gsiSortKeyType) {
    attributeDefinitions.push({
      AttributeName: props.gsiSortKeyName,
      AttributeType: props.gsiSortKeyType
    });
    keySchema.push({
      AttributeName: props.gsiSortKeyName,
      KeyType: 'RANGE'
    });
  }

  try {
    await tableActive(props.tableName);
    await ddb.updateTable({
      TableName: props.tableName,
      AttributeDefinitions: attributeDefinitions,
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: props.indexName,
            KeySchema: keySchema,
            Projection: {
              ProjectionType: 'ALL'
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: props.gsiReadCapacity || 5,
              WriteCapacityUnits: props.gsiWriteCapacity || 5
            }
          }
        }
      ]
    }).promise();
    console.info(`GSI '${props.indexName}' created `);
    console.info(`waiting GSI '${props.indexName}' to be active`);
    await tableActive(props.tableName);
  } catch (err) {
    console.error(`Failed to add GSI '${props.indexName}'\n${err}`);
    throw err;
  }
};

const onCreate = async (event: lambda.CloudFormationCustomResourceCreateEvent): Promise<DynamoDBTableGSIResourceEventResponse> => {
  const properties = event.ResourceProperties as DynamoDBTableGSIResourceProperties;
  await createGSI(properties);
  return { IsComplete: true };
}

export const onEvent = async (event: lambda.CloudFormationCustomResourceEvent): Promise<DynamoDBTableGSIResourceEventResponse> => {
  switch (event.RequestType) {
    case 'Create': return onCreate(event);
    case 'Update': return { IsComplete: true };
    case 'Delete': return { IsComplete: true };
  }
};

export const isComplete = async (event: DynamoDBTableGSIResourceCompleteEvent): Promise<DynamoDBTableGSIResourceCompleteEventResponse> => {
  return event;
};
