import * as aws from 'aws-sdk';
import * as core from '@passit/core-functions';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { Insertion } from './models/insertion';

type FunctionParams = {
  after?: string;
  limit?: string;
  tutorId?: string;
};

const ddb = new core.DynamoDB<Insertion>({ apiVersion: '2012-08-10' });

export const handler: APIGatewayProxyHandler = async (event) => {
  var startKey: aws.DynamoDB.DocumentClient.Key | undefined;
  var indexName: string | undefined;
  var keyCondition: string | undefined;
  var limit: number | undefined;
  var values: any | undefined;
  const res = new core.HttpResponse<core.EntityConnection<Insertion> | core.HttpErrorResponse>();
  const params = event.queryStringParameters as FunctionParams;

  if (params) {
    if (params.after && params.after !== '') {
      startKey = { 'id': params.after };
    }
    if (params.tutorId && params.tutorId !== '') {
      indexName = 'tutor-index';
      keyCondition = 'tutorId = :tutorId';
      values = { ':tutorId': params.tutorId };
      if (params.after && params.after !== '') {
        startKey = { ...startKey, 'tutorId': params.tutorId }
      }
    }
    if (params.limit && params.limit !== '') {
      limit = +params.limit;
    }
  }

  try {
    const insertionConnection = await ddb.getData({
      TableName: process.env.INSERTIONS_TABLE_NAME!,
      IndexName: indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
      ExclusiveStartKey: startKey,
      Limit: limit
    });
    return res.status(200).json(insertionConnection);
  } catch (err) {
    return res.status(500).json({ message: JSON.stringify(err) });
  }
};
