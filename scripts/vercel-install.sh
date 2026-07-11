#!/usr/bin/env bash
# Used as Vercel Install Command — keeps logs clear if npm dies mid-install.
set -euo pipefail
echo "Node: $(node -v)"
echo "npm:  $(npm -v)"
echo "PWD:  $(pwd)"
ls -la package.json package-lock.json .npmrc
npm install --no-audit --no-fund --legacy-peer-deps
echo "Install finished. react-scripts present:"
ls node_modules/react-scripts/bin/react-scripts.js
