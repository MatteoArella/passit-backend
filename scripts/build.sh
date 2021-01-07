#!/usr/bin/env bash
set -euxo pipefail

export PATH=$(npm bin):$PATH

lerna run build
