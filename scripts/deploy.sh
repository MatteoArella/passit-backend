#!/usr/bin/env bash
set -euxo pipefail

export PATH=$(npm bin):$PATH

[ "${CI-}" = "true" ] && \
  (cdk deploy --require-approval never &> cdk.out/deploy.out && \
  sed '/Outputs/q' cdk.out/deploy.out) || \
cdk deploy --require-approval never
