import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as iam from '@aws-cdk/aws-iam';
import { join } from 'path';
import * as dotenv from 'dotenv';
import * as core from '@passit/core-infra';

dotenv.config();

export interface InsertionsStackProps extends cdk.NestedStackProps {
  esDomain: es.Domain;
}

export class InsertionsStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  private stageName: string = 'v1';

  constructor(scope: cdk.Construct, id: string, props: InsertionsStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'InsertionsRestApi', {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ]
      },
      failOnWarnings: true,
      defaultMethodOptions: {
        authorizationType: apigateway.AuthorizationType.IAM
      },
      deploy: true,
      deployOptions: {
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        stageName: this.stageName
      }
    });

    const partitionKey: dynamodb.Attribute = {
      name: 'id',
      type: dynamodb.AttributeType.STRING
    };
    const insertionsTable = new dynamodb.Table(this, 'InsertionsTable', {
      tableName: 'insertions',
      partitionKey: partitionKey,
      billingMode: dynamodb.BillingMode.PROVISIONED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });
    insertionsTable.addGlobalSecondaryIndex({
      indexName: 'tutor-index',
      partitionKey: {
        name: 'tutorId',
        type: dynamodb.AttributeType.STRING
      }
    });

    new core.DynamoDBIndexElasticSearch(this, 'InsertionsIndex', {
      domain: props.esDomain,
      table: insertionsTable,
      partitionKey: partitionKey
    });

    const createInsertionLambda = new core.Function(this, 'CreateInsertionLambda', {
      functionName: 'create-insertion-function',
      entry: join(__dirname, 'functions/createInsertion.ts'),
      handler: 'handler',
      environment: {
        'INSERTIONS_TABLE_NAME': insertionsTable.tableName
      }
    });

    const getInsertionByIdLambda = new core.Function(this, 'GetInsertionByIdLambda', {
      functionName: 'get-insertion-by-id-function',
      entry: join(__dirname, 'functions/getInsertionById.ts'),
      handler: 'handler',
      environment: {
        'INSERTIONS_TABLE_NAME': insertionsTable.tableName
      }
    });

    const getInsertionsLambda = new core.Function(this, 'GetInsertionsLambda', {
      functionName: 'get-insertions-function',
      entry: join(__dirname, 'functions/getInsertions.ts'),
      handler: 'handler',
      environment: {
        'INSERTIONS_TABLE_NAME': insertionsTable.tableName
      }
    });

    insertionsTable.grantWriteData(createInsertionLambda);
    insertionsTable.grantReadData(getInsertionByIdLambda);
    insertionsTable.grantReadData(getInsertionsLambda);

    createInsertionLambda.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    getInsertionByIdLambda.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
    getInsertionsLambda.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const locationSchema: apigateway.JsonSchema = {
      schema: apigateway.JsonSchemaVersion.DRAFT4,
      type: apigateway.JsonSchemaType.OBJECT,
      properties: {
        'country': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the country where the insertion is offered'
        },
        'state': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the state where the insertion is offered'
        },
        'city': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the city where the insertion is offered'
        }
      },
      required: [ 'country', 'state', 'city' ]
    };
    const locationModel = this.api.addModel('Location', {
      schema: locationSchema,
      contentType: 'application/json',
      description: 'Location model',
      modelName: 'Location'
    });

    const insertionSchema: apigateway.JsonSchema = {
      schema: apigateway.JsonSchemaVersion.DRAFT4,
      type: apigateway.JsonSchemaType.OBJECT,
      properties: {
        'id': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the ID of the insertion'
        },
        'subject': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the subject of the insertion'
        },
        'title': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the title of the insertion'
        },
        'description': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the description of the insertion'
        },
        'location': {
          ref: `https://apigateway.amazonaws.com/restapis/${this.api.restApiId}/models/${locationModel.modelId}`
        },
        'tutorId': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the ID of the tutor who created the insertion'
        },
        'createdAt': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the creation date of the insertion'
        },
        'updatedAt': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the last modification date of the insertion'
        }
      },
      required: [ 'subject', 'title', 'description', 'tutorId', 'location' ]
    };
    const insertionModel = this.api.addModel('Insertion', {
      schema: insertionSchema,
      contentType: 'application/json',
      description: 'Insertion model',
      modelName: 'Insertion'
    });

    const insertionConnectionSchema: apigateway.JsonSchema = {
      schema: apigateway.JsonSchemaVersion.DRAFT4,
      type: apigateway.JsonSchemaType.OBJECT,
      properties: {
        'items': {
          type: apigateway.JsonSchemaType.ARRAY,
          items: {
            ref: `https://apigateway.amazonaws.com/restapis/${this.api.restApiId}/models/${insertionModel.modelId}`
          }
        },
        'after': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the next token for pagination'
        }
      }
    }
    const insertionConnectionModel = this.api.addModel('InsertionConnection', {
      schema: insertionConnectionSchema,
      contentType: 'application/json',
      description: 'Insertion connection model for pagination',
      modelName: 'InsertionConnection'
    });

    const insertions = this.api.root.addResource('insertions');
    // create insertion
    insertions.addMethod('POST', new apigateway.LambdaIntegration(createInsertionLambda), {
      operationName: 'CreateInsertion',
      requestModels: { 'application/json': insertionModel },
      requestValidator: new apigateway.RequestValidator(this, 'CreateInsertionRequestValidator', {
        restApi: this.api,
        validateRequestBody: true
      }),
      methodResponses: [
        {
          statusCode: '201',
          responseModels: { 'application/json': insertionModel }
        },
        {
          statusCode: '400',
          responseModels: { 'application/json': apigateway.Model.ERROR_MODEL }
        },
        {
          statusCode: '500',
          responseModels: { 'application/json': apigateway.Model.ERROR_MODEL }
        }
      ]
    });
    // get insertion by id
    insertions.addResource('{insertionId}').addMethod('GET', new apigateway.LambdaIntegration(getInsertionByIdLambda), {
      operationName: 'GetInsertionById',
      methodResponses: [
        {
          statusCode: '200',
          responseModels: { 'application/json': insertionModel }
        },
        {
          statusCode: '404',
          responseModels: { 'application/json': apigateway.Model.ERROR_MODEL }
        }
      ]
    });
    // get insertions
    insertions.addMethod('GET', new apigateway.LambdaIntegration(getInsertionsLambda), {
      operationName: 'GetInsertions',
      requestParameters: {
        'method.request.querystring.tutorId': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.after': false
      },
      requestValidator: new apigateway.RequestValidator(this, 'GetInsertionsRequestValidator', {
        restApi: this.api,
        validateRequestParameters: true
      }),
      methodResponses: [
        {
          statusCode: '200',
          responseModels: { 'application/json': insertionConnectionModel }
        },
        {
          statusCode: '500',
          responseModels: { 'application/json': apigateway.Model.ERROR_MODEL }
        }
      ]
    });

    new cdk.CfnOutput(this, 'InsertionsServiceApiId', {
      exportName: 'InsertionsServiceApiId',
      value: this.api.restApiId
    });

    new cdk.CfnOutput(this, 'InsertionsServiceApiStageName', {
      exportName: 'InsertionsServiceApiStageName',
      value: this.stageName
    });
  }
}
