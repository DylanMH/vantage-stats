# 🚀 GitHub Repository Setup Guide

Follow these steps to push your project to GitHub and set up releases.

## Step 1: Initialize Git Repository (if not already done)

```bash
cd c:\Users\dylan\Desktop\kovaaks-insight
git init
```

## Step 2: Add All Files

```bash
git add .
```

## Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: Kovaak's Insight v1.0"
```

## Step 4: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **"+"** button in the top right
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name**: `kovaaks-insight`
   - **Description**: `A powerful desktop app for tracking and analyzing Kovaak's FPS Aim Trainer performance`
   - **Visibility**: Choose Public (for open source) or Private
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)

## Step 5: Connect Local Repo to GitHub

Replace `YOUR_USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR_USERNAME/kovaaks-insight.git
git branch -M main
git push -u origin main
```

## Step 6: Update README URLs

After creating the repo, update these URLs in `README.md`:

- Line with `https://github.com/yourusername/kovaaks-insight` → Your actual repo URL
- All issue/discussion links

## Step 7: Set Up GitHub Releases (Optional)

### Option A: Manual Releases

1. Go to your GitHub repo
2. Click **"Releases"** tab
3. Click **"Create a new release"**
4. Tag version: `v1.0.0`
5. Release title: `Kovaak's Insight v1.0.0`
6. Upload the built `.exe` file from `dist/` folder
7. Write release notes describing features
8. Click **"Publish release"**

### Option B: Automated Releases (Advanced)

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Build app
      run: npm run dist
    
    - name: Upload Release Asset
      uses: softprops/action-gh-release@v1
      with:
        files: dist/*.exe
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then create releases with:
```bash
git tag v1.0.0
git push origin v1.0.0
```

## Step 8: Add Repository Topics/Tags

On your GitHub repo page:

1. Click the **⚙️** icon next to "About"
2. Add topics: `kovaaks`, `aim-trainer`, `electron`, `react`, `typescript`, `gaming`, `analytics`, `desktop-app`
3. Add website (if you have one)
4. Save changes

## Step 9: Enable GitHub Features

### Issues
- Go to Settings → Features → Check "Issues"
- Create issue templates (optional)

### Discussions
- Go to Settings → Features → Check "Discussions"
- Good for community Q&A

### Wiki
- Enable if you want to add detailed documentation

## Step 10: Create a .github Folder (Optional but Recommended)

```bash
mkdir .github
mkdir .github/ISSUE_TEMPLATE
```

Create issue templates for bug reports and feature requests.

## Useful Git Commands

```bash
# Check status
git status

# See commit history
git log --oneline

# Create and switch to new branch
git checkout -b feature/new-feature

# Push new branch to GitHub
git push -u origin feature/new-feature

# Pull latest changes
git pull origin main

# Create a new tag
git tag v1.0.1
git push origin v1.0.1
```

## Tips for Maintaining Your Repo

1. **Commit often** with clear messages
2. **Use branches** for new features
3. **Write release notes** for each version
4. **Respond to issues** and PRs
5. **Keep README updated** with latest features
6. **Tag releases** semantically (v1.0.0, v1.1.0, v2.0.0)

## Versioning Guidelines

Follow Semantic Versioning (SemVer):

- **MAJOR** (v2.0.0): Breaking changes
- **MINOR** (v1.1.0): New features, backward-compatible
- **PATCH** (v1.0.1): Bug fixes, backward-compatible

Examples:
- `v1.0.0` - Initial release
- `v1.1.0` - Added theme system
- `v1.1.1` - Fixed chart bug
- `v2.0.0` - Complete UI redesign (breaking changes)

---

**You're all set! Your project is now on GitHub! 🎉**
