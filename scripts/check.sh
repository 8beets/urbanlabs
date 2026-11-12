#!/bin/sh
set -eu

npm run format:check
npm run lint
npm run db:types
npm run typecheck
npm test
npm run test:d1
npm run db:migrate
npm run e2e:build
npm run check:build
npm run e2e
