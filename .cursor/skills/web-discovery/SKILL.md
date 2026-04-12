---
name: web-discovery
description: >-
  Discover up-to-date knowledge from the internet using targeted web searches.
  Use when the user asks to "search the web", "look up", "find the latest",
  "research", "discover", or when implementing something that requires current
  library versions, API docs, best practices, or external knowledge not reliably
  in training data (e.g. new npm packages, third-party APIs, recent changelogs).
---

# Web Discovery

Research and surface current, accurate information from the web before writing code or making recommendations.

## When to Use

- Library/package API that may have changed since training cutoff
- Choosing between external dependencies (compare docs, versions, ecosystems)
- Third-party API integration (auth flows, endpoints, rate limits)
- Best practices for a technology version newer than 2024
- Verifying that a package exists and is maintained before adding it

## Discovery Workflow

1. **Formulate a targeted query** — include the technology name, version if known, and the year (`2026`) for recency
2. **Run `WebSearch`** — use the `search_term` field with a specific, well-formed query
3. **Scan results** — identify 1–2 authoritative sources (official docs, GitHub, changelog)
4. **Fetch detail if needed** — use `WebFetch` on a specific URL when the search summary isn't sufficient
5. **Synthesize** — extract only what's needed; don't paste walls of docs into context

## Query Patterns

| Goal | Query format |
|---|---|
| Latest version & API | `<package> API documentation 2026` |
| Migration guide | `migrate <package> v2 to v3 guide` |
| Comparison | `<A> vs <B> <use-case> 2026` |
| Error/issue | `<error message> <framework> fix 2026` |
| Best practice | `<technology> best practices production 2026` |

## Rules

- Always include the year `2026` in searches for evolving technologies
- Prefer official docs and GitHub READMEs over blog aggregators
- If a package hasn't been updated in 2+ years, flag it as potentially unmaintained
- Never fabricate a package version — if unsure, search first
- Cite the source URL when sharing findings with the user

## Example

**User:** "What's the latest way to stream OpenAI responses in NestJS?"

```
1. Search: "OpenAI streaming NestJS 2026"
2. Fetch official OpenAI streaming docs if needed
3. Check openai npm package changelog for breaking changes
4. Synthesize: return the current pattern with correct method names
```
