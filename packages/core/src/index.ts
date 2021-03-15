import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaNodejs from '@aws-cdk/aws-lambda-nodejs';
import { MappingTemplate } from './appsync';

class Function extends lambdaNodejs.NodejsFunction {
  constructor(scope: cdk.Construct, id: string, props: lambdaNodejs.NodejsFunctionProps) {
    super(scope, id, {
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true
      },
      ...props
    });
  }
}

export { Function, MappingTemplate };
