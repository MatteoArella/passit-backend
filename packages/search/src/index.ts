import * as cdk from '@aws-cdk/core';
import * as es from '@aws-cdk/aws-elasticsearch';
import * as dotenv from 'dotenv';

dotenv.config();

export class SearchStack extends cdk.NestedStack {
  public readonly domain: es.Domain;

  constructor(scope: cdk.Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    this.domain = new es.Domain(this, 'ESDomain', {
      version: es.ElasticsearchVersion.V7_9,
      enableVersionUpgrade: true,
      capacity: {
        dataNodeInstanceType: 't3.small.elasticsearch' // free-tier eligible
      },
      nodeToNodeEncryption: true,
      encryptionAtRest: {
        enabled: true
      },
      ebs: {
        volumeSize: 10,
        enabled: true
      },
      enforceHttps: true
    });

    new cdk.CfnOutput(this, 'SearchServiceDomainEndpoint', {
      exportName: 'SearchServiceDomainEndpoint',
      value: this.domain.domainEndpoint
    });
  }
}
