# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Report them privately through GitHub's
**Security → Report a vulnerability** (private vulnerability reporting) on this repository.

Include what you found, steps to reproduce, and the impact. We aim to acknowledge reports within 7 days.

## Scope notes

- No secrets are stored in this repository. Server secrets live in the hosting provider's secret store.
- Data access is enforced by Postgres Row Level Security and column-level grants; admin actions are authorised on the server.
