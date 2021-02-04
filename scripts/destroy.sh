#!/usr/bin/env bash
set -euxo pipefail

export PATH=$(npm bin):$PATH

cdk destroy --force
