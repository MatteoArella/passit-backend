import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as appsync from '@aws-cdk/aws-appsync';
import * as cognito from '@aws-cdk/aws-cognito';
import * as iam from '@aws-cdk/aws-iam';
import * as core from '@passit/core';
import { join } from 'path';

export interface ApiStackProps extends cdk.NestedStackProps {
  userPool: cognito.IUserPool;
  authenticatedRole: iam.Role;
}

export class ApiStack extends cdk.NestedStack {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: cdk.Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const usersServiceRestApi = apigateway.RestApi.fromRestApiId(this, 'UsersServiceApiId', cdk.Fn.importValue('UsersServiceApiId'));
    const usersServiceApiStageName = cdk.Fn.importValue('UsersServiceApiStageName');

    this.api = new appsync.GraphqlApi(this, 'GraphApi', {
      name: 'GraphApi',
      schema: appsync.Schema.fromAsset(join(__dirname, 'assets/schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM
        }
      },
      xrayEnabled: true,
      logConfig: {
        excludeVerboseContent: false,
        fieldLogLevel: appsync.FieldLogLevel.ALL
      }
    });

    props.authenticatedRole.attachInlinePolicy(new iam.Policy(this, 'ApiAuthenticatedRoleIAMPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [ 'appsync:GraphQL' ],
          effect: iam.Effect.ALLOW,
          resources: [ `arn:aws:appsync:${this.region}:${this.account}:apis/${this.api.apiId}/*` ]
        })
      ]
    }));

    const usersServiceDs = this.api.addHttpDataSource('UsersServiceDataSource', `https://${usersServiceRestApi.restApiId}.execute-api.${this.region}.amazonaws.com`, {
      authorizationConfig: {
        signingRegion: this.region,
        signingServiceName: 'execute-api'
      }
    });

    iam.Role.fromRoleArn(this, 'UsersServiceDataSourceRole', usersServiceDs.ds.serviceRoleArn!)
      .attachInlinePolicy(new iam.Policy(this, 'UsersServiceDataSourcePolicy', {
        statements: [
          new iam.PolicyStatement({
            actions: [ 'execute-api:Invoke' ],
            effect: iam.Effect.ALLOW,
            resources: [ usersServiceRestApi.arnForExecuteApi() ]
          })
        ]
      }));

    usersServiceDs.createResolver({
      typeName: 'Query',
      fieldName: 'me',
      requestMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.req.vtl'), {
        stageName: usersServiceApiStageName
      }),
      responseMappingTemplate: core.MappingTemplate.fromFile(join(__dirname, 'resolvers/users/Query.me.res.vtl'))
    });
  }
}
