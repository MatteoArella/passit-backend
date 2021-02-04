#!/usr/bin/env bash
set -euxo pipefail

export PATH=$(npm bin):$PATH

cdk deploy --require-approval never &> cdk.out/deploy.out
sed '/Outputs/q' cdk.out/deploy.out
