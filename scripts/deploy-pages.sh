#!/usr/bin/env bash
# Builds the app and publishes dist/ to the gh-pages branch (GitHub Pages).
set -e
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git add -A
git -c core.autocrlf=false commit -q -m "Deploy CATALYX Mission Design Lab"
git push -q --force "$(cd .. && git remote get-url origin)" gh-pages
echo "Published to gh-pages"
