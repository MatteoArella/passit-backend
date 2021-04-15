import { AWSError, DynamoDB } from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { HttpResponse, HttpErrorResponse } from '@passit/core-functions';
import moment from 'moment';
import { Insertion, InsertionStatus, Location } from './models/insertion';

type FunctionPathParams = {
  insertionId: string;
};

type FunctionUpdateParams = {
  tutorId: string;
  subject?: string;
  title?: string;
  description?: string;
  location?: Location;
  status?: InsertionStatus;

  [key: string]: string | Location | undefined;
};

const ddb = new DynamoDB.DocumentClient();

export const handler: APIGatewayProxyHandler = async (event) => {
  const res = new HttpResponse<Insertion | HttpErrorResponse>();
  if (!event.body) {
    return res.status(400).json({ message: 'bad request' });
  }

  const insertionId = (event.pathParameters as FunctionPathParams).insertionId;
  const params = JSON.parse(event.body) as FunctionUpdateParams;

  const updateExpressionFields: string[] = [];
  const expressionFieldsNames: DynamoDB.DocumentClient.ExpressionAttributeNameMap = {};
  const expressionFieldsValues: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {};
  const datetime = moment().toISOString();

  Object.entries(params).forEach(([key, value]) => {
    updateExpressionFields.push(`#${key} = :${key}`);
    expressionFieldsNames[`#${key}`] = key;
    expressionFieldsValues[`:${key}`] = value;
  });
  updateExpressionFields.push('updatedAt = :updatedAt');
  expressionFieldsValues[':updatedAt'] = datetime;

  const updateExpression = `set ${updateExpressionFields.join(', ')}`;
  try {
    const { Attributes: insertion } = await ddb.update({
      TableName: process.env.INSERTIONS_TABLE_NAME!,
      Key: { 'id': insertionId },
      ConditionExpression: 'tutorId = :tutorId',
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionFieldsNames,
      ExpressionAttributeValues: expressionFieldsValues,
      ReturnValues: 'ALL_NEW'
    }).promise();
    return res.status(200).json(insertion as Insertion);
  } catch (err) {
    const error = err as AWSError;
    switch (error.code) {
      case 'ConditionalCheckFailedException':
        return res.status(403).json({ message: 'unauthorized' });
      case 'ResourceNotFoundException':
        return res.status(404).json({ message: 'insertion not found' });
      default:
        return res.status(500).json({ message: JSON.stringify(err) });
    }
  }
};
