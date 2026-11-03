# Web Apps Release Instructions

This document outlines the standard process for releasing updates to web applications following semantic versioning principles.

## Example: Explorer v1.1.0 Release

### 1. Create a Release Issue

- Create a new issue in the project repository
- Title: `Release Explorer v1.1.0` or `explorer: Release v1.1.0`, if using prefix to the issue title
- Add appropriate labels (e.g. module: `explorer`, type: `task`)

### 2. Create a Release Branch

- Create a branch from the latest `main`
- Name the branch using the issue number (e.g., `feature-ABC-123`)
- **Note:** Do not use version numbers for branch names to avoid conflicts with tags

```bash
git checkout main
git pull
git checkout -b feature-ABC-123
```

### 3. Update Version Number

- Use npm version commands to bump version according to semantic versioning:
  - `npm version patch` (for bug fixes and minor changes)
  - `npm version minor` (for new features, backward compatible)
  - `npm version major` (for breaking changes)
- For this example: `npm version minor`

```bash
npm version minor
```

### 4. Update the CHANGELOG.md

- Add a new section for the version being released
- Copy relevant changes from "Unreleased" section to the new version section
- Keep the "Unreleased" section with any features that remain hidden to users
- Ensure the format follows the project's changelog conventions
- Add the version to the bottom of the changelog under "Versions"

Example CHANGELOG.md format:

```markdown
# Changelog

All notable changes to Explorer will be documented in this file.

## [Unreleased]

- New analytics dashboard layout (in progress)
- Experimental dark mode theme

## [1.1.0] - 2025-04-22

### Added

- Multi-account support
- Export functionality for transaction history
- Enhanced filtering options

### Changed

- Improved loading performance by 35%
- Updated UI components for better mobile experience

### Fixed

- Transaction history pagination issue
- Search functionality in asset explorer

## [1.0.1] - 2025-03-15

...

<!-- VERSIONS -->

[1.1.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.1.0
[1.0.0]: https://github.com/dusk-network/explorer/tree/explorer-v1.0.0
```

### 5. Create and Review Pull Request

- Commit and push the changes
- Open a PR targeting `main`
- Copy the changelog section for the new version into the PR description
- Request code review from team members

```bash
git add CHANGELOG.md package.json package-lock.json
git commit -m "explorer: Release v1.1.0"
git push origin feature-ABC-123
```

### 6. Create Annotated Tag

**Option A: Tag from branch (after approval)**

```bash
git tag -a explorer-v1.1.0 -m "Explorer: Release v1.1.0"
```

**Option B: Merge to main then tag (recommended)**

```bash
git checkout main
git pull
git tag -a explorer-v1.1.0 -m "Explorer: Release v1.1.0"
```

**Important note:** Ensure the tag name (`explorer-v1.1.0`) matches exactly with the entry added to the CHANGELOG.md in step 4.

### 7. Push the Tag

```bash
git push origin explorer-v1.1.0
```

The tag deploys to mainnet through the Deploy workflow. Every merge to `main` is already on testnet and devnet, so test the features in the changelog there before pushing it.

### 8. Troubleshooting Deployment

If errors occur during deployment:

- Check the Deploy workflow's log for specific errors
- Confirm that all dependencies are properly resolved
- If the workflow failed before deploying, run it again; nothing has changed on the site

### 9. Final Validation

- Confirm the application works correctly across all production environments
- Verify the product version displayed in the UI matches the released version
- Test all key user flows and features on different devices and browsers
- Monitor error logs and performance metrics

### 10. Announce the Release

- Notify marketing team to prepare community announcement
- Directly inform stakeholders whose requested features or fixes are included
- Provide specific details to team members about changes that affect their work
- Consider posting in relevant Discord channels, email lists, or other communication platforms
- For major releases, coordinate with marketing on blog posts or social media announcements

## Rollback Procedure (If Needed)

If critical issues are discovered after deployment:

1. Identify the last stable tag/version
2. Roll the affected Worker back to that version in Cloudflare
3. Create a hotfix branch from the stable tag
4. Fix the issue and follow an expedited version of the release process
5. Communicate transparently about the issue and resolution

## Release Checklist

- [ ] Create issue for release
- [ ] Create feature branch with issue number
- [ ] Update version with npm version command
- [ ] Update CHANGELOG.md
- [ ] Open and get approval on PR
- [ ] Verify on testnet and devnet
- [ ] Create and push annotated tag
- [ ] Verify on mainnet
- [ ] Final validation across environments
- [ ] Announce release to stakeholders
