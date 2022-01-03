#!/bin/bash

echo Updating npm dependencies
npm outdated
npm run ncu-upgrade
npm --silent install
npm outdated
npm audit
npm audit --fix

echo Changes:
git diff

