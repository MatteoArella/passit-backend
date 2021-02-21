import { APIGatewayProxyResult } from 'aws-lambda';

export type HttpErrorResponse = {
  message: string;
};

export class HttpResponse<T> implements APIGatewayProxyResult {
  statusCode: number;
  body: string;

  constructor() {
    this.statusCode = 200;
    this.body = '';
  }

  status(statusCode: number): HttpResponse<T> {
    this.statusCode = statusCode;
    return this;
  }

  json(body: T): HttpResponse<T> {
    this.body = JSON.stringify(body);
    return this;
  }
}