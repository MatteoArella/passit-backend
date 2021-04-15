import * as aws from 'aws-sdk';
import * as core from '@passit/core-functions';
import { Handler } from 'aws-lambda';
import { Message } from './models/message';

type FunctionParams = {
  after?: string;
  limit?: string;
  conversationId: string;
};

const ddb = new core.DynamoDB<Message>();

export const handler: Handler<FunctionParams, core.EntityConnection<Message>> = async (event) => {
  var indexName = 'conversation-index';
  var keyCondition = 'conversationId = :conversationId';
  var values = { ':conversationId': event.conversationId };
  var startKey: aws.DynamoDB.DocumentClient.Key | undefined;
  var limit: number | undefined;

  if (event.after && event.after !== '') {
    startKey = { 'id': event.after, 'conversationId': event.conversationId }
  }
  if (event.limit && event.limit !== '') {
    limit = +event.limit;
  }

  return await ddb.getData({
    TableName: process.env.MESSAGES_TABLE_NAME!,
    IndexName: indexName,
    KeyConditionExpression: keyCondition,
    ExpressionAttributeValues: values,
    ExclusiveStartKey: startKey,
    Limit: limit,
    ScanIndexForward: false
  });
};
