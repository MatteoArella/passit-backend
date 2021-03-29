import { APIGatewayProxyHandler } from 'aws-lambda';
import { HttpResponse, HttpErrorResponse, DynamoDB } from '@passit/core-functions';
import { Insertion } from './models/insertion';

type FunctionParams = {
  insertionId: string;
};

const ddb = new DynamoDB<Insertion>();

export const handler: APIGatewayProxyHandler = async (event) => {
  const res = new HttpResponse<Insertion | HttpErrorResponse>();
  const params = event.pathParameters as FunctionParams;

  try {
    const { Item: insertion } = await ddb.get({
      TableName: process.env.INSERTIONS_TABLE_NAME!,
      Key: { 'id': params.insertionId }
    }).promise();
    if (!insertion) return res.status(404).json({ message: 'insertion not found' })
    return res.status(200).json(insertion as Insertion);
  } catch (err) {
    return res.status(404).json({ message: JSON.stringify(err) });
  }
};
