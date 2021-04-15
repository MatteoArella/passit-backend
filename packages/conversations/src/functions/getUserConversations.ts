import * as aws from 'aws-sdk';
import * as core from '@passit/core-functions';
import { Handler } from 'aws-lambda';
import { ConvLink } from './models/convLink';

type FunctionParams = {
  after?: string;
  limit?: string;
  userId: string;
};

const ddb = new core.DynamoDB<ConvLink>();

export const handler: Handler<FunctionParams, core.EntityConnection<ConvLink>> = async (event) => {
  var indexName = 'user-index';
  var keyCondition = 'userId = :userId';
  var values = { ':userId': event.userId };
  var startKey: aws.DynamoDB.DocumentClient.Key | undefined;
  var limit: number | undefined;

  if (event.after && event.after !== '') {
    startKey = { 'id': event.after, 'userId': event.userId }
  }
  if (event.limit && event.limit !== '') {
    limit = +event.limit;
  }

  return await ddb.getData({
    TableName: process.env.CONV_LINKS_TABLE_NAME!,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: values,
    ExclusiveStartKey: startKey,
    Limit: limit,
    ScanIndexForward: false
  });
};
