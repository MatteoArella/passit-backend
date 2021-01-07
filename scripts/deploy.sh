#!/usr/bin/env bash
set -euxo pipefail

export PATH=$(npm bin):$PATH

cdk deploy --require-approval never
