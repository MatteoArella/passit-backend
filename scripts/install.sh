#!/usr/bin/env bash
set -euxo pipefail

yarn install --frozen-lockfile

export PATH=$(npm bin):$PATH

lerna bootstrap
