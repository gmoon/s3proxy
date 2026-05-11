---
name: lattice
description: "Lattice knowledge graph integration. Use when working in a project with a .lattice/ directory — for requirements, theses, sources, implementations, drift detection, or lattice CLI commands."
allowed-tools: Bash(lattice *), Bash(./target/release/lattice *), Bash(./target/debug/lattice *), Bash(gh issue *), Read, Grep, Glob
---

# Lattice Skill

You have access to a **Lattice** knowledge graph in this project. The `.lattice/` directory contains the structured knowledge graph (YAML files). Use the `lattice` CLI to query and modify it.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY in this document are to be interpreted as described in RFC 2119.

## Quick Reference

```bash
lattice summary                  # Status overview (counts, drift, health)
lattice list requirements        # All requirements
lattice list requirements -s active --format json  # Filtered, JSON output
lattice get REQ-XXX-001          # Full node details with edges
lattice plan REQ-A REQ-B         # Implementation order for requirements
lattice drift                    # Check for stale edge bindings
lattice lint                     # Structural issues
lattice search -q "keyword"      # Text search (defaults to requirements)
lattice edit REQ-XXX --title "..." # Edit node fields (auto-bumps version)
lattice add edge --from IMP-XXX --type satisfies --to REQ-XXX  # Wire edges
lattice remove edge --from IMP-XXX --type satisfies --to REQ-XXX  # Remove edges
lattice replace edge --from IMP-XXX --type satisfies --old-to REQ-OLD --new-to REQ-NEW  # Retarget edges
lattice update                   # Self-update to latest version
lattice update --check           # Check for updates without installing
```

## Editing Rules

Agents MUST use the `lattice` CLI for all supported operations.
The CLI handles timestamps, version bumps, edge wiring, and ID validation.

If the CLI does not support a required operation, agents MAY edit `.lattice/` YAML files directly, but MUST run `lattice lint` immediately after to verify correctness.

If a CLI gap is found, agents SHOULD file an issue on `forkzero/lattice` describing the missing capability:
```bash
gh issue create --repo forkzero/lattice \
  --title "CLI gap: <what's missing>" \
  --body "Encountered while working on <context>. Had to edit YAML directly because <reason>." \
  --label "cli-gap"
```

## Workflow

### Before Starting Work
1. Run `lattice summary` to understand the current state
2. Run `lattice plan` or `lattice search --priority P0 --resolution unresolved` to find what to work on
3. Run `lattice get REQ-XXX` to read full requirement details before implementing

### While Working
- Reference requirement IDs in commits: `Implements REQ-XXX-001`
- Use `lattice get <ID> --format json` for structured data when you need to parse output

### After Completing Work
- `lattice resolve REQ-XXX --verified` to mark requirements as done
- `lattice verify IMP-XXX satisfies REQ-XXX --tests-pass` to record satisfaction evidence
- If you implemented a new feature, add matching requirement(s) and resolve them as verified
- `lattice edit IMP-XXX --body "updated description" --files "src/new.rs,src/lib.rs" --test-command "cargo test"` to update implementation nodes
- `lattice add edge --from IMP-XXX --type satisfies --to REQ-XXX` to wire new edges
- Run `lattice drift` to confirm no unresolved drift

### If Gaps Are Found
- `lattice refine REQ-XXX --gap-type missing_requirement --title "..." --description "..."` to create sub-requirements
- `lattice add edge --from IMP-XXX --type reveals_gap_in --to REQ-XXX --rationale "..."` to record feedback

## Node Types

| Type | ID Pattern | Purpose |
|------|-----------|---------|
| Source | `SRC-XXX` | Research, papers, references |
| Thesis | `THX-XXX` | Strategic claims backed by sources |
| Requirement | `REQ-XXX-NNN` | Testable specifications derived from theses |
| Implementation | `IMP-XXX-NNN` | Code that satisfies requirements |

## Edge Types

| Edge | Direction | Meaning |
|------|----------|---------|
| `supports` | Source → Thesis | Evidence backing a claim |
| `derives` | Thesis → Requirement | Specification from strategy |
| `satisfies` | Implementation → Requirement | Code fulfills spec |
| `depends_on` | Requirement → Requirement | Dependency ordering |
| `reveals_gap_in` | Implementation → Requirement/Thesis | Discovered underspecification |
| `challenges` | Any → Thesis | Contradictory evidence |
| `validates` | Implementation → Thesis | Confirming evidence |

## Resolution States

- `verified` — Implemented and tested
- `blocked` — Waiting on external dependency (with reason)
- `deferred` — Postponed to later milestone (with reason)
- `wontfix` — Rejected or out of scope (with reason)

## Adding Nodes

```bash
lattice add requirement \
  --id REQ-FEAT-001 --title "Short description" \
  --body "Detailed specification" --priority P1 \
  --category FEAT --derives-from THX-XXX --created-by "agent:claude"

lattice add thesis \
  --id THX-NEW --title "Claim" --body "Reasoning" \
  --category technical --supported-by SRC-XXX --created-by "agent:claude"

lattice add source \
  --id SRC-NEW --title "Reference" --body "Summary" \
  --url "https://..." --created-by "agent:claude"

lattice add implementation \
  --id IMP-FEAT-001 --title "Feature implementation" \
  --body "Description of what was implemented" \
  --language rust --files "src/main.rs,src/lib.rs" \
  --test-command "cargo test" --satisfies REQ-FEAT-001 \
  --created-by "agent:claude"

lattice add edge \
  --from IMP-XXX --type validates --to THX-XXX \
  --rationale "Implementation confirms thesis"
```

## Managing Edges

```bash
# Remove an edge
lattice remove edge --from IMP-XXX --type satisfies --to REQ-XXX

# Replace an edge target (retarget to a different node)
lattice replace edge --from IMP-XXX --type satisfies \
  --old-to REQ-OLD --new-to REQ-NEW --rationale "Requirement was split"
```

## Editing Nodes

```bash
lattice edit REQ-XXX --title "New title" --body "New body"
lattice edit REQ-XXX --priority P0 --tags "core,storage"
lattice edit IMP-XXX --files "src/new.rs,src/lib.rs" --test-command "cargo test"
lattice edit IMP-XXX --body "Updated description" --status active
```

Agents MUST use `lattice edit` to modify existing nodes. The `edit` command auto-bumps the patch version and preserves all other fields. Type-specific flags: `--priority` (requirements only), `--files` and `--test-command` (implementations only).

## JSON Output

All read and write commands accept `--format json` for structured output. Use this when you need to parse results programmatically.

## Drift Detection

Edges are version-bound. When a node is updated, edges referencing the old version become stale. Run `lattice drift` to detect these. Use `lattice drift --check` in CI (exits non-zero on drift).

## Product Owner Agent

For backlog triage, strategic critique, and planning work, use the **product-owner** agent (`/product-owner`). It manages the lattice as persistent working memory for product strategy.
