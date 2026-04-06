# Conversation branching

This document describes the **conversation branching** feature for CentrAI-Chat: what it is, why it exists, and how users interact with it—especially **inline branching** from an assistant message.

---

## Purpose

Branching lets you **split a conversation into a new path from any specific point** in the thread. That path is a first-class continuation: you keep everything **before** the branch point and explore alternatives **after** it without overwriting the original exchange.

Typical uses:

- **Explore alternatives** — try different follow-ups from the same assistant reply.
- **Compare models or agents** — branch from the same user prompt or assistant turn and continue with another model or agent where the product allows it.
- **Recover from bad answers** — when a reply is wrong or a “hallucination,” branch from **before** or **at** that turn so earlier context stays intact while you steer the conversation differently.

Branching is complementary to a linear “edit and regenerate” flow (also scoped for v1 in the product roadmap): both preserve history structurally instead of silently replacing messages.

---

## Concepts

| Concept | Meaning |
|--------|---------|
| **Thread** | The ordered sequence of messages the user sees for one conversation. |
| **Branch point** | A specific message (usually an **assistant** message) from which a new continuation is created. |
| **Branch / version** | One of several alternative continuations after the same predecessor message. Multiple assistant replies can share the same **parent** user turn (or the same preceding assistant message, depending on product rules). |
| **Active path** | The branch the UI is currently showing from the branch point downward; switching branches changes which continuation is visible without deleting the others. |
| **Forked conversation** (optional product behavior) | A **new conversation** that copies history up to the branch point and continues independently. Useful for long-lived separation or listing forks in the sidebar—exact exposure is a product decision. |

The mental model is similar to **Git branches**: one shared history up to a commit, then divergent lines that you can switch between.

---

## Inline branching (primary UX)

Inline branching is the default, in-thread way to create and navigate branches without leaving the message list.

### Where to branch

1. Locate the **assistant message** you want to branch from.
2. Find the **assistant response header** (the row that shows metadata such as **model name**, and optionally agent name or timestamps).

### Creating a branch

3. Click the **branch control** in that header — represented by a **branch icon** (e.g. GitBranchPlus-style: branch with a plus).

**Result:** The product creates a new continuation from that message. Depending on implementation, this may mean:

- a new **sibling** assistant path under the same user message, or  
- a **forked conversation** that opens while preserving lineage metadata.

The user can then send the next message on that new path.

### Cycling through versions

After more than one branch exists at the same point, the UI should offer **branch navigation** (e.g. previous / next controls and an indicator such as “2 of 3”) so the user can **cycle through alternative continuations** at that position in the thread—analogous to flipping between versions of the conversation at that fork.

**Accessibility:** Branch controls should have clear labels (e.g. “Previous branch”, “Next branch”, “Branch from this message”) and work with keyboard where other message actions do.

---

## What branching is not

- **Not** a wholesale delete of later messages unless the user explicitly chooses a destructive action—default branching should **add** paths, not remove history silently.
- **Not** a way for end users to see hidden system prompts or admin-only configuration; branching only affects **their** transcript and continuation rules already enforced by chat APIs.

---

## Permissions and visibility

Branching follows the same rules as the parent conversation:

- Only the **owner** (and any future shared-workspace rules) can branch and view branches.
- **End users** branch within conversations they already own; **admins** do not gain access to user branches beyond existing admin policies.

---

## Relation to platform scope

Conversation branching is listed under **v1.2 Chat UI** in [SCOPE.md](./SCOPE.md) (“edit & regenerate from any message”). Inline branching from an assistant header is one concrete UX pattern for that capability; the chat service architecture in [ARCHITECTURE.md](./ARCHITECTURE.md) describes fork-style operations at a high level (`forkConversation`-style flows).

---

## Persistence direction (engineering)

To support trees of messages and optional fork lineage, persistence can model:

- **`messages.parent_id`** — links each message to its predecessor so multiple children represent branches from the same parent.
- **Conversation-level fork metadata** — e.g. which conversation this was **forked from**, at which **message id**, and which message id is the **active leaf** for the thread the UI shows by default.

Exact API shapes, list/export behavior for branched threads, and whether forks appear as new sidebar conversations should be specified in API and UI tickets derived from this document.

---

## Summary

| User goal | Action |
|-----------|--------|
| Try a different continuation from an assistant turn | Use the **branch icon** on that assistant **header** (model row). |
| Compare alternatives at the same point | Use **branch prev/next** (or equivalent) to cycle **versions**. |
| Keep earlier context while escaping a bad path | Branch from the last **good** assistant message (or the user message before it, per product rules), then continue on the new path. |

This document is the **product-facing baseline** for branching UX and terminology; implementation checklists should stay aligned with it as the API and chat UI land.
