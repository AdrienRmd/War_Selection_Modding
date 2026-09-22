# Security notes

This private source snapshot contains no intentionally included production secrets or databases. Keep `.env`, `.dev.vars`, private keys, runtime state, user uploads and production exports out of Git.

## Authentication is hosting-dependent

`app/chatgpt-auth.ts` currently accepts identity headers supplied by the trusted Sites gateway. That is not standalone authentication. **Do not deploy this code behind an arbitrary public server that accepts those headers from visitors.** Replace this boundary with validated sessions before migrating away from Sites.

Local sign-in simulation must remain bound to loopback development. Never publish the development server or enable a public tunnel to it.

The owner configures real `ADMIN_EMAILS` privately on the hosting platform. `.env.example` contains only a fake local test identity. Never commit actual administrator settings or grant administrator privileges to the first visitor.

## Uploads and testing

Uploaded Lua/ZIP files are stored, not executed. File signature checks are not malware scanning. Schema files are not backups of production data. Run tests against local disposable data only.

If you find a security issue, contact the repository owner privately. Do not include credentials or player data in an issue, screenshot, commit or pull request. No guarantee of a complete security audit is implied by this export.
