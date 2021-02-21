import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as cognito from '@aws-cdk/aws-cognito';
import * as iam from '@aws-cdk/aws-iam';
import { join } from 'path';
import * as dotenv from 'dotenv';
import * as core from '@passit/core';

dotenv.config();

export interface UsersStackProps extends cdk.NestedStackProps {
  userPool: cognito.IUserPool;
}

export class UsersStack extends cdk.NestedStack {
  public readonly api: apigateway.RestApi;
  private stageName: string = 'v1';

  constructor(scope: cdk.Construct, id: string, props: UsersStackProps) {
    super(scope, id, props);

    this.api = new apigateway.RestApi(this, 'RestApi', {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ]
      },
      failOnWarnings: true,
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

    const users = this.api.root.addResource('users');
    users.addResource('{userId}').addMethod('GET', new apigateway.LambdaIntegration(getUserByIdLambda), {
      authorizationType: apigateway.AuthorizationType.IAM,
      operationName: 'GetUserById'
    });

    new cdk.CfnOutput(this, 'UsersServiceApiId', {
      exportName: 'UsersServiceApiId',
      value: this.api.restApiId
    });

    new cdk.CfnOutput(this, 'UsersServiceApiStageName', {
      exportName: 'UsersServiceApiStageName',
      value: this.stageName
    });

    new cdk.CfnOutput(this, 'UsersServiceApiEndpoint', {
      exportName: 'UsersServiceApiEndpoint',
      value: this.api.url
    });
  }
}
