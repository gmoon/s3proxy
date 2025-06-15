#!/bin/bash

# Create Pull Request Helper Script
# Usage: ./scripts/create-pr.sh "feat: Feature Name" "Description of changes"

set -e

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh"
    echo "Or download from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI is not authenticated."
    echo "Run: gh auth login"
    exit 1
fi

# Get parameters
TITLE="${1:-feat: Update}"
DESCRIPTION="${2:-Automated update}"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" = "master" ]; then
    echo "❌ Cannot create PR from master branch"
    exit 1
fi

echo "🚀 Creating Pull Request..."
echo "Branch: $CURRENT_BRANCH → master"
echo "Title: $TITLE"
echo ""

# Create PR with template
gh pr create \
  --title "$TITLE" \
  --body "## 🚀 Changes

$DESCRIPTION

### ✅ **Pre-Release Checklist:**
- [ ] \`make pre-release-check\` passes
- [ ] CI/CD pipeline passes on branch
- [ ] All tests pass (49/49)
- [ ] TypeScript build succeeds
- [ ] No critical security issues

### 📊 **Quality Metrics:**
- Tests: $(npm run test:unit --silent 2>/dev/null | grep -o '[0-9]* passed' | head -1 || echo 'Run tests to verify')
- Coverage: $(npm run test:coverage --silent 2>/dev/null | grep -o '[0-9]*\.[0-9]*%' | head -1 || echo 'Run coverage to verify')
- Build: $(npm run build --silent 2>/dev/null && echo '✅ Success' || echo '❌ Failed')

### 🎯 **Ready for Review:**
This PR is ready for review and merge.

---
*Created with: \`./scripts/create-pr.sh\`*" \
  --base master \
  --head "$CURRENT_BRANCH"

echo ""
echo "✅ Pull Request created successfully!"
echo "🔗 View at: $(gh pr view --web --json url --jq .url 2>/dev/null || echo 'Check GitHub repository')"
