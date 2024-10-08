#!/usr/bin/env bash

# this wrapper merely needed for transparently use --env-file without much fuss.
# .env file is mandatory for Appril apps in dev mode (and pgxt-cli used for dev purposes only)
node \
  --env-file=.env \
  --enable-source-maps \
  --no-warnings=ExperimentalWarning \
  "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/cli.mjs" "$@"
