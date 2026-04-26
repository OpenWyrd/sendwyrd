---
type: agents_guide
created: 2026-04-24
updated: 2026-04-24
last_edited_by: agent_operator
tags: [agents, context, inspiration]
---

# Inspiration Archive — Agent Guide

## Purpose

This directory holds **adjacency context** that informs the user's design temperament for MOP but is **NOT canonical product specification**.

These documents were shared by the user during the founding architecture session (2026-04-24) with the explicit instruction:

> "These next two things are orthogonal that are thematically related, but are not meant to be canonical descriptions of what we are now building."

## Contents

| File | What it is | What it gives an agent |
|------|------------|------------------------|
| `inspiration_weak_ties_game.md` | Voice-relay graph traversal experiment ("Weak Ties Graph Traversal Game") | Insight into the user's network/percolation thinking; bias toward trust-mediated distribution; weak-tie theory as substrate |
| `inspiration_tweetjoin.md` | Group-chat-mediated tweet relay protocol ("TweetJoin") | The user's explicit conjecture: *"relational-first architectures overpower object-first architectures"*; cypherpunk-Nietzschean register; design temperament for rule-light, ritual-heavy protocols |
| `inspiration_bin_21.md` | Encrypted pastebin (`bin.t21.dev`, MIT-licensed at `t21dev/bin-21`) shipped 2025–2026 | Stack-convergence validation (Next.js + TS + Tailwind + Postgres/Drizzle + R2 = ADR-020 within Cloudflare-vs-Railway divergence); architectural mirror highlighting where SendWyrd intentionally diverges (capability-URL vs password); operational ideas (burn-after-read, bot-protection layer) |

## How to use these (and how not to)

**Use them to**:
- Understand why MOP is biased toward bearer-capability, anti-feed, anti-algorithm architectures.
- Inform tone and aesthetic choices (e.g., VISION.md voice, naming, framing).
- Calibrate scope decisions when a feature might drift toward "social network" or "messenger" territory.

**Do NOT**:
- Map their specific primitives onto MOP's architecture.
- Treat their philosophical claims (e.g., "voice over text," "relational-first over object-first") as MOP requirements. The user resolved the relational/object tension explicitly: MOP is *object-first as practical implementation, relational-first as distribution substrate.*
- Quote them as design constraints in ADRs or specs without the user's explicit re-affirmation.
