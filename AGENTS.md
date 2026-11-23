<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Server logic lives in `src/lib/*.functions.ts` (public, solver, admin); shared server helpers in `src/lib/server-utils.server.ts`. Why: keeps the service-role client out of client bundles.
- Every admin server function calls `assertAdmin` (role checked with the caller's own token) before using the admin client. Why: the `/admin` route gate is UX only.
- Moderation status transitions live only in `src/lib/review-rules.ts`, used by server, UI and tests. Why: one source of truth for what reviewers may do.
- Query options for every page live in `src/lib/queries.ts`; pages prime them in loaders and read with `useSuspenseQuery`. Why: consistent caching and invalidation keys (`["me", …]`, `["admin", …]`).
- Router query clients use a short default freshness window and intent preloading with Query-owned freshness; retain explicit query overrides and mutation invalidation. Why: reuse loader data across mounts without suppressing updates.
- Turnstile is required server-side in production (TURNSTILE secrets must be set); outside production it is skipped when keys are absent. Rate limiting and the honeypot always apply.
