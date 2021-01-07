import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import { MappingTemplate } from './appsync';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

type FunctionProps = PartialBy<lambda.FunctionProps, 'runtime'>

interface DefaultFunctionProps {
  runtime: lambda.Runtime;
  timeout?: cdk.Duration;
  memorySize?: number;
  tracing?: lambda.Tracing;
};

class Function extends lambda.Function {
  constructor(scope: cdk.Construct, id: string, props: FunctionProps) {
    const defaultProps: DefaultFunctionProps = {
      runtime: lambda.Runtime.NODEJS_12_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE
    };
    super(scope, id, { ...defaultProps, ...props });
  }
}

class FunctionLayer extends lambda.LayerVersion {
  constructor(scope: cdk.Construct, id: string, props: lambda.LayerVersionProps) {
    super(scope, id, { compatibleRuntimes: [lambda.Runtime.NODEJS_12_X], ...props });
  }
}

export { FunctionProps, Function, FunctionLayer, MappingTemplate };
