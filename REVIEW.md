# Langplay review

## Completed improvements
- Help bubbles render outside frames, stay within screen edges, and support keyboard focus.
- Buttons keep readable text in selected and hovered states. Status indicators no longer use button-like containers.
- Motion lives in Settings. Changing it preserves open panels and recipe state. Reduced-motion preferences disable background motion and icon animation.
- React Bits hold-to-delete supports pointer and keyboard holds, cancels on early release, and cleans up timers. Squish switches, thought-line run feedback, border glow, letter glitch and click sparks replace the cursor chaser.
- Icons have distinct breathing, tracing, scanning, rotating and nudging animations.
- Cookbooks offer task filters, sorting, learning previews, author text when available, extracted prompt choices and detected account requirements. Name-based topic hints are explicitly labelled as inferred.
- Prompt Hub previews show editable prompt text, required values and provenance; missing values block installation.
- Tools, MCPs, plugins and skills have curated source directories plus task/access/type filters, sorting, setup details and session-only shortlists.
- External recipe JSON is schema-validated and reviewed before installation. Unknown step types, inherited property names and malformed recipes are rejected.
- Model-list responses are checked before use. Late model or connection-test responses cannot replace newer settings.
- Direct AI requests have a timeout; remote connections require HTTPS, with HTTP permitted for local services only. Puter loading is shared between requests and has a timeout.
- Background drawing pauses in hidden tabs; click sparks draw only while active and reach portal dialogs.

## Verified
- Browser: visible top-bar tooltip, motion settings without reset, short-tap safety, keyboard hold deletion, extension filtering/details, recipe preview/install/run, Simulator connection readiness, live cookbook listing, public Hub retrieval and required-value validation.
- Desktop checks showed no horizontal overflow or uncaught page errors.
- Automated tests cover free-model safety, recipe validation, catalogue provenance, notebook extraction and malformed external data.
- Content page has its own Langplay title, description and social metadata.

## Deliberate limits
- External directories are discovery sources, not installed runtime extensions. Shortlists last for the current page session.
- Cookbook imports adapt prompt text only. Notebook code, tools, document stores and bundled skill scripts do not execute.
- Search and document steps currently use explicitly labelled sample results. AI replies can be real when a compatible connection is selected.
- GitHub rate limits and browser access restrictions can interrupt public downloads. Some sources contain no automatically extractable prompt or readable introductory text; manual review remains necessary.
- Keyed providers were not tested with private accounts. Account allowances are user-confirmed, not a live balance guarantee. Local AI services require their own browser-access setup.

## Next connection opportunities
1. Add permission-scoped live search and document uploads, with clear source citations and spending limits.
2. Add connected-service login and a secure execution service before running MCP tools or app actions. Start read-only, require confirmation for writes, and never execute imported scripts automatically.
3. Add skill-text adaptation after source and licence review, separate from executable skill packages.
4. Add saved recipes and cross-device shortlists with user accounts, rather than silently changing browser-only storage.
5. Add maintained directory refreshes, source-content indexing and stronger content-derived summaries instead of relying on file names for initial topic hints.
6. Split the playground into builder, run and concept views when adding execution capabilities; retain the existing shared learning state and deliberate reward rules.