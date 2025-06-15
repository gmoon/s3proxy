# 🚀 Release Quick Reference

## **⚡ Fast Release Process**

```bash
# 1. Pre-release verification
make pre-release-check

# 2. Push branch and verify CI passes
git push origin feature-branch

# 3. Commit changes
git add .
git commit -m "feat: description

BREAKING CHANGE: if applicable"

# 4. Create PR automatically
npm run pr:create "feat: Feature Name" "Description"
# OR manually:
gh pr create --title "feat: Name" --body "Description" --base master

# 5. Merge PR → Release happens automatically

# 6. Verify release
npm view s3proxy@latest
```

## **🔧 One-Time Setup Commands**

```bash
# Install GitHub CLI (macOS)
brew install gh

# Authenticate GitHub CLI
gh auth login

# Add NPM_TOKEN to GitHub repository secrets
# (Do this via GitHub web interface)
```

## **📋 Troubleshooting Commands**

```bash
# Fix linting issues
npm run lint:fix

# Check CI status
gh pr checks

# View PR in browser
gh pr view --web

# Check release workflow
gh run list --workflow=release.yml

# Test package locally
npm pack && npm install ./s3proxy-*.tgz
```

## **🎯 Success Indicators**

- ✅ `make pre-release-check` passes
- ✅ GitHub Actions CI passes on branch
- ✅ PR created and merged successfully
- ✅ Release workflow completes
- ✅ New version appears on npm
- ✅ GitHub release created with notes

## **📊 Current Project Status**

- **Tests**: 49/49 passing (100%)
- **Coverage**: 92.34%
- **Node.js**: 18, 20, 22 supported
- **TypeScript**: 5.7
- **Release**: Automated via semantic-release

---

*Keep this handy for quick releases! 🚀*
