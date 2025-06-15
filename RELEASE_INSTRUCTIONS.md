# 🚀 Release Management Guide

## **📋 One-Time Configuration (Setup Once)**

### **Step 1: NPM Authentication Setup**

**Get NPM Token:**
1. Go to [npmjs.com](https://npmjs.com) and login
2. Navigate to "Access Tokens" in your profile
3. Click "Generate New Token"
4. Select "Automation" type
5. Copy the token (starts with `npm_`)

**Add Token to GitHub:**
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Your npm token
6. Click "Add secret"

### **Step 2: GitHub CLI Setup (Optional - for PR automation)**

**Install GitHub CLI:**
```bash
# macOS
brew install gh

# Or download from https://cli.github.com/
```

**Authenticate GitHub CLI:**
```bash
gh auth login
# Follow prompts to authenticate with your GitHub account
```

### **Step 3: Verify Release Infrastructure**

**Check GitHub Actions workflows exist:**
- `.github/workflows/release.yml` (automated release)
- `.github/workflows/manual-release.yml` (manual release)
- `.github/workflows/nodejs.yml` (CI/CD pipeline)

**Verify semantic-release configuration:**
- `.releaserc.json` (semantic-release config)
- `package.json` contains semantic-release dependencies

✅ **Configuration complete! You only need to do this once.**

---

## **🔄 Release Process (Repeatable)**

### **Phase 1: Pre-Release Verification (2 minutes)**

**Step 1: Run Pre-Release Check**
```bash
# Verify everything is ready for release
make pre-release-check
```

**Expected Results:**
- ✅ All 49 tests pass
- ✅ TypeScript build succeeds
- ✅ Package contents verified
- ✅ Type checking passes
- ⚠️ Linting warnings acceptable
- ⚠️ Security audit shows non-critical issues

**If any critical step fails, fix issues before proceeding.**

---

### **Phase 2: Test CI/CD Pipeline (5 minutes)**

**Step 2: Push Branch and Verify CI**
```bash
# Push your feature branch to test CI/CD
git push origin typescript-migration

# Watch GitHub Actions run on your branch
# Go to: GitHub → Actions tab → Watch workflows complete
```

**What to verify:**
- ✅ "Node CI" workflow passes (audit, test, docker-tests)
- ✅ All jobs complete successfully
- ✅ No failures in the pipeline

**This ensures your changes will work when merged to master.**

---

### **Phase 3: Commit and Create Pull Request (5 minutes)**

**Step 3: Commit Your Changes**
```bash
# Add all changes
git add .

# Commit with conventional commit format
git commit -m "feat: complete TypeScript migration with 49/49 tests passing

- Modern TypeScript 5.7 codebase with dual ESM/CommonJS exports
- Comprehensive AWS mocking for reliable unit tests  
- 96.64% test coverage with all 49 tests passing
- Modern toolchain (Biome, Vitest) with 100x faster linting
- Clean project structure with legacy files removed
- Production-ready Docker integration
- Automated release infrastructure with semantic-release

BREAKING CHANGE: Migrated from JavaScript to TypeScript, requires Node.js 18+"

# Push the committed changes
git push origin typescript-migration
```

**Step 4: Create Pull Request**

**Option A: Automatic PR Creation (Recommended)**
```bash
# Create PR automatically with GitHub CLI
gh pr create \
  --title "feat: Complete TypeScript Migration" \
  --body "## 🚀 TypeScript Migration Complete

### ✅ **Achievements:**
- **49/49 tests passing** (100% success rate)
- **96.64% test coverage** with comprehensive AWS mocking
- **Modern TypeScript 5.7** with dual ESM/CommonJS exports
- **100x faster linting** with Biome vs ESLint
- **Clean project structure** with legacy files removed
- **Production-ready** Docker integration
- **Automated release infrastructure** ready

### 🔄 **Breaking Changes:**
- Migrated from JavaScript to TypeScript
- Requires Node.js 18+ (was 16+)
- Some internal APIs may have changed (public API unchanged)

### 📊 **Quality Metrics:**
- All unit tests passing
- Type checking passes
- Build succeeds
- Security audit clean (no critical issues)
- CI/CD pipeline verified

### 🎯 **Ready for Release:**
This PR represents a major milestone and is ready for immediate release as v4.0.0.

Closes #[issue-number] (if applicable)" \
  --base master \
  --head typescript-migration
```

**Option B: Manual PR Creation**
1. Go to GitHub repository
2. Click "Compare & pull request" 
3. Set base: `master`, compare: `typescript-migration`
4. Title: `feat: Complete TypeScript Migration`
5. Add description (use content from Option A above)
6. Create pull request

---

### **Phase 4: Merge and Release (10 minutes)**

**Step 5: Review and Merge PR**
1. **Review the PR** (or have team review)
2. **Verify CI checks pass** on the PR
3. **Merge the PR** (use "Squash and merge" or "Merge commit")

**Step 6: Monitor Automated Release**
```bash
# After merge, watch the release happen automatically
# Go to: GitHub → Actions tab → Watch "Release" workflow
```

**What happens automatically:**
- ✅ Determines version (4.0.0 due to BREAKING CHANGE)
- ✅ Generates changelog from commit messages
- ✅ Creates Git tag (v4.0.0)
- ✅ Publishes to npm
- ✅ Creates GitHub release with notes

---

### **Phase 5: Verify Release Success (5 minutes)**

**Step 7: Verify Release**

**Check GitHub Release:**
1. Go to GitHub → Releases
2. Verify new release appears with correct version
3. Check auto-generated release notes
4. Verify package file is attached

**Check NPM Publication:**
```bash
# Verify package is published
npm view s3proxy@latest

# Should show new version (4.0.0+) and TypeScript info
```

**Test Installation:**
```bash
# Quick installation test
mkdir /tmp/test-release && cd /tmp/test-release
npm init -y && npm install s3proxy@latest

# Test both module systems
node -e "const S3Proxy = require('s3proxy'); console.log('✅ CommonJS works');"
node -e "import('s3proxy').then(m => console.log('✅ ESM works'));"

# Cleanup
cd - && rm -rf /tmp/test-release
```

---

### **Phase 6: Post-Release Cleanup (2 minutes)**

**Step 8: Clean Up**
```bash
# Switch to master and pull latest changes
git checkout master
git pull origin master

# Delete feature branch (optional)
git branch -d typescript-migration
git push origin --delete typescript-migration

# Verify you have the release commit
git log --oneline -3
```

---

## **🎯 Quick Reference**

### **For Future Releases:**
```bash
# 1. Pre-release check
make pre-release-check

# 2. Push and verify CI
git push origin feature-branch

# 3. Commit changes
git add . && git commit -m "feat: description"

# 4. Create PR automatically
gh pr create --title "feat: Feature Name" --body "Description" --base master

# 5. Merge PR → Release happens automatically

# 6. Verify release
npm view s3proxy@latest
```

### **Manual Release (if needed):**
1. Go to GitHub → Actions
2. Select "Manual Release" workflow
3. Click "Run workflow"
4. Fill in version and options
5. Run workflow

---

## **🚨 Troubleshooting**

### **If CI fails on branch:**
- Check GitHub Actions logs
- Fix issues and push again
- Don't create PR until CI passes

### **If PR creation fails:**
```bash
# Check GitHub CLI authentication
gh auth status

# Re-authenticate if needed
gh auth login
```

### **If release fails:**
- Check GitHub Actions logs in "Release" workflow
- Verify NPM_TOKEN is set correctly
- Check semantic-release configuration

### **If NPM publish fails:**
- Verify package name availability
- Check npm permissions
- Ensure NPM_TOKEN has publish rights

---

## **✅ Success Criteria**

After each release, you should have:
- [ ] ✅ **CI passes on feature branch**
- [ ] ✅ **PR created and merged successfully**
- [ ] ✅ **New version on npm** (`npm view s3proxy@latest`)
- [ ] ✅ **New GitHub release** with auto-generated notes
- [ ] ✅ **Git tag created** (e.g., v4.0.0)
- [ ] ✅ **Package installable** and both ESM/CJS work
- [ ] ✅ **Branch cleaned up** (optional)

---

## **🎉 You're Ready to Release!**

**This process is now:**
- ✅ **Repeatable** - Same steps for every release
- ✅ **Automated** - 95% of work done automatically
- ✅ **Safe** - CI verification before merge
- ✅ **Professional** - Proper versioning and release notes

**Next release will be even faster** since configuration is complete! 🚀

---

*Updated: 2025-06-14*  
*Status: Ready for repeatable releases*  
*Next: Run `make pre-release-check` to start your first release*
