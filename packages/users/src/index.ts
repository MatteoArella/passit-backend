import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cognito from '@aws-cdk/aws-cognito';
import * as iam from '@aws-cdk/aws-iam';
import { join } from 'path';
import * as dotenv from 'dotenv';
import * as core from '@passit/core-infra';

dotenv.config();

export interface UsersStackProps extends cdk.NestedStackProps {
  userPool: cognito.IUserPool;
}

export class UsersStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  private stageName: string = 'v1';

  constructor(scope: cdk.Construct, id: string, props: UsersStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'UsersRestApi', {
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

    const getUserByIdLambda = new core.Function(this, 'GetUserByIdLambda', {
      functionName: 'get-user-by-id-function',
      entry: join(__dirname, 'functions/getUserById.ts'),
      handler: 'handler',
      environment: {
        'USER_POOL_ID': props.userPool.userPoolId
      }
    });
    getUserByIdLambda.role!.attachInlinePolicy(new iam.Policy(this, 'GetUserByIdLambdaPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [ 'cognito-idp:ListUsers' ],
          resources: [ props.userPool.userPoolArn ]
        })
      ]
    }));
    
    getUserByIdLambda.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    const userSchema: apigateway.JsonSchema = {
      schema: apigateway.JsonSchemaVersion.DRAFT4,
      type: apigateway.JsonSchemaType.OBJECT,
      properties: {
        'id': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the ID of the user'
        },
        'email': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the email of the user'
        },
        'familyName': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the family name of the user'
        },
        'givenName': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the given name of the user'
        },
        'phoneNumber': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the phone number of the user'
        },
        'birthDate': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the birth date of the user'
        },
        'picture': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the picture url of the user'
        },
        'createdAt': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the creation date of the user'
        },
        'updatedAt': {
          type: apigateway.JsonSchemaType.STRING,
          description: 'the last modification date of the user'
        }
      },
      required: [ 'id', 'email', 'familyName', 'givenName', 'createdAt' ]
    };
    const userModel = this.api.addModel('User', {
      schema: userSchema,
      contentType: 'application/json',
      description: 'User model',
      modelName: 'User'
    });

    const users = this.api.root.addResource('users');
    users.addResource('{userId}').addMethod('GET', new apigateway.LambdaIntegration(getUserByIdLambda), {
      operationName: 'GetUserById',
      methodResponses: [
        {
          statusCode: '200',
          responseModels: { 'application/json': userModel }
        },
        {
          statusCode: '404',
          responseModels: { 'application/json': apigateway.Model.ERROR_MODEL }
        }
      ]
    });

    new cdk.CfnOutput(this, 'UsersServiceApiId', {
      exportName: 'UsersServiceApiId',
      value: this.api.restApiId
    });

    new cdk.CfnOutput(this, 'UsersServiceApiStageName', {
      exportName: 'UsersServiceApiStageName',
      value: this.stageName
    });
  }
}
