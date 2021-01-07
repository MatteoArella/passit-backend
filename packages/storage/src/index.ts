import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as iam from '@aws-cdk/aws-iam';
import * as dotenv from 'dotenv';

dotenv.config();

export class StorageStack extends cdk.NestedStack {
  public readonly bucket: s3.Bucket;

  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'StorageServiceBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false
      })
    });
    this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: [ 's3:GetObject' ],
      effect: iam.Effect.ALLOW,
      principals: [ new iam.AnyPrincipal() ],
      resources: [ this.bucket.arnForObjects('public/*') ]
    }));
  }
}
