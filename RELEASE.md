# Release Management Guide

## 🚀 Release Strategy

This project supports two release approaches:

### **Option 1: Automated Releases (Recommended)**
Uses semantic-release to automatically determine versions and create releases based on commit messages.

### **Option 2: Manual Releases**
Allows manual control over version numbers and release timing.

---

## 🔄 **Automated Releases (Semantic Release)**

### **How it Works:**
1. **Commit messages** determine release type using [Conventional Commits](https://www.conventionalcommits.org/)
2. **Automatic versioning** based on commit types
3. **Automatic changelog** generation
4. **Automatic npm publish** and GitHub release

### **Commit Message Format:**
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### **Release Types:**
- `feat:` → **Minor release** (1.0.0 → 1.1.0)
- `fix:` → **Patch release** (1.0.0 → 1.0.1)
- `perf:` → **Patch release** (performance improvement)
- `BREAKING CHANGE:` → **Major release** (1.0.0 → 2.0.0)
- `docs:`, `style:`, `test:`, `chore:` → **No release**

### **Examples:**
```bash
# Patch release (3.0.0 → 3.0.1)
git commit -m "fix: resolve Docker container startup issue"

# Minor release (3.0.0 → 3.1.0)
git commit -m "feat: add support for custom headers"

# Major release (3.0.0 → 4.0.0)
git commit -m "feat!: remove deprecated API methods

BREAKING CHANGE: The legacy v1 API has been removed"
```

### **Triggering Automated Release:**
1. Push commits to `main` branch
2. GitHub Actions automatically runs release workflow
3. If commits warrant a release, it will:
   - Determine new version number
   - Generate changelog
   - Create Git tag
   - Publish to npm
   - Create GitHub release

---

## 🎯 **Manual Releases**

### **When to Use:**
- Need specific version number
- Want to control release timing
- Creating pre-releases or beta versions

### **How to Trigger:**
1. Go to **Actions** tab in GitHub
2. Select **Manual Release** workflow
3. Click **Run workflow**
4. Fill in:
   - **Version**: e.g., `3.1.0`
   - **Release type**: patch/minor/major
   - **Prerelease**: check if beta/alpha

### **What Happens:**
1. Runs full test suite
2. Updates package.json version
3. Builds project
4. Creates Git tag
5. Publishes to npm
6. Creates GitHub release with notes

---

## 📋 **Release Checklist**

### **Before Release:**
- [ ] All tests passing (49/49)
- [ ] Code coverage acceptable (>95%)
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide created (if needed)

### **After Release:**
- [ ] Verify npm package published
- [ ] Verify GitHub release created
- [ ] Test installation: `npm install s3proxy@latest`
- [ ] Update dependent projects
- [ ] Announce release (if significant)

---

## 🔧 **Setup Requirements**

### **GitHub Secrets Needed:**
```bash
# For npm publishing
NPM_TOKEN=npm_xxxxxxxxxxxx

# GitHub token (automatically provided)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### **NPM Token Setup:**
1. Login to npmjs.com
2. Go to Access Tokens
3. Generate new token with "Automation" type
4. Add to GitHub repository secrets as `NPM_TOKEN`

---

## 📊 **Release Automation Benefits**

### **Semantic Release Advantages:**
- ✅ **Consistent versioning** following semver
- ✅ **Automatic changelog** generation
- ✅ **No human error** in version numbers
- ✅ **Fast releases** (no manual steps)
- ✅ **Complete audit trail** via commit history

### **Manual Release Advantages:**
- ✅ **Full control** over timing and versioning
- ✅ **Custom release notes** possible
- ✅ **Pre-release support** (beta, alpha)
- ✅ **Emergency releases** when needed

---

## 🎯 **Current Release Status**

- **Current Version**: 3.0.0
- **Release Strategy**: Ready for both automated and manual
- **Package Status**: Production ready
- **Test Coverage**: 96.64% (49/49 tests passing)
- **Compatibility**: Node.js 18, 20, 22

---

## 🚀 **Next Steps**

1. **Choose release strategy** (automated vs manual)
2. **Set up NPM_TOKEN** in GitHub secrets
3. **Make first release** to validate workflow
4. **Document any project-specific release notes**

The release infrastructure is now **production-ready** and follows industry best practices! 🎯
