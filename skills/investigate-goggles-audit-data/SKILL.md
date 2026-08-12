---
name: investigate-goggles-audit-data
description: Fetch and analyze sensitive Marmot audit data from the Goggles read-only API. Use when an agent needs to investigate a group, diagnose message delivery, compare engines, analyze MLS epochs or convergence, inspect network publication, correlate state changes, or trace derived findings back to audit evidence.
---

# Goggles Audit Investigation

Use Goggles as a read-only forensic data source. Treat bearer tokens, group IDs, account references, engine IDs, message IDs, transport IDs, payload digests, relay URLs, decrypted content, and raw audit evidence as sensitive.

## Configuration

Read connection details from environment variables:

```text
GOGGLES_BASE_URL=https://goggles.ipf.dev
GOGGLES_ACCESS_TOKEN=gpat_...
```

Default `GOGGLES_BASE_URL` to `https://goggles.ipf.dev` when it is unset.

Require a `gpat_` personal access token. Never use an upload token beginning with `goggles_` for reads.

Never:

- Print or log the access token.
- Put the token in a URL or query parameter.
- Commit the token to a repository or skill.
- Include raw forensic data in telemetry, tickets, or external services.
- Upload, revoke, or modify data unless explicitly authorized.
- Guess group IDs or enumerate unauthorized resources.

## Create a read-only credential

A Goggles personal access token is a reusable, read-only credential. It can never upload audit data.

### Self-service creation

1. Sign in to Goggles.
2. Open `${GOGGLES_BASE_URL}/profile/`.
3. Create a personal access token with a descriptive name.
4. Prefer a bounded expiry.
5. Copy the raw `gpat_...` token when it is displayed. It is shown only once.
6. Store it in the harness’s secret manager or `GOGGLES_ACCESS_TOKEN` environment variable.

### Operator creation

From the Goggles Django application environment, run:

```bash
uv run python manage.py create_access_token \
  "audit-investigation-agent" \
  --user <username> \
  --expires-in-days 30
```

`--expires-in-days` is optional, but prefer an explicit expiry for agent credentials.

The token stops authenticating when:

- Its owner revokes it.
- An administrator deactivates or deletes it.
- Its expiry passes.
- Its owning user is deactivated.

The token is not a one-time code. Successful use updates `last_used_at` but does not consume or revoke it.

If a token may have leaked, tell the operator to revoke it immediately and issue a replacement. Never repeat a leaked token in the report.

## Read the credential safely

Read the token directly from the environment inside the HTTP client:

```python
import os

token = os.environ["GOGGLES_ACCESS_TOKEN"]
if not token.startswith("gpat_"):
    raise RuntimeError("GOGGLES_ACCESS_TOKEN is not a read-only Goggles token")
```

Do not print `token`, include it in exceptions, or pass it to subprocesses unnecessarily.

Send it only as:

```http
Authorization: Bearer gpat_...
```

## Discover readable groups

When the deployed Goggles version supports token-authenticated group discovery, request:

```http
GET /api/v1/groups/?limit=100
Authorization: Bearer gpat_...
Accept: application/json
```

The response uses schema `goggles-groups/v1` and returns group metadata rather than audit evidence.

Follow these rules:

1. Begin without a `cursor`.
2. Follow `pagination.next_cursor` while `pagination.has_more` is true.
3. Treat cursors as opaque. Never inspect, modify, log, or construct one.
4. Deduplicate groups by `slug`.
5. Use the exact returned `slug` for exports.
6. Do not assume a display name or `group_ref` is interchangeable with the slug.

An optional `updated_since=<ISO-8601 timestamp>` filter can reduce repeated work, but it is only a best-effort change hint. Database transactions can commit after a polling watermark with an earlier `updated_at`.

For eventual completeness:

- Periodically perform a full traversal without `updated_since`.
- Deduplicate the results by `slug`.
- Do not interpret an empty incremental response as proof that the complete index is unchanged.

Some deployments allow personal access tokens only on the exact group-export endpoint. If group discovery redirects to login or returns `401`, test the token against a known authorized group export before declaring the token invalid. Ask the user for an exact group slug when discovery is unavailable.

Do not scrape the HTML interface to discover groups.

## Fetch a complete group export

Request:

```http
GET /api/v1/groups/{slug}/export/
Authorization: Bearer gpat_...
Accept: application/x-ndjson
```

The export is complete and unfiltered. Query filters do not apply to it.

A shell request is:

```bash
curl --fail-with-body --no-buffer \
  --header "Authorization: Bearer ${GOGGLES_ACCESS_TOKEN:?missing token}" \
  --header "Accept: application/x-ndjson" \
  "${GOGGLES_BASE_URL:-https://goggles.ipf.dev}/api/v1/groups/<slug>/export/"
```

Prefer an in-process HTTP client over shell execution so the token does not appear in subprocess arguments or diagnostic output.

Stream the response line-by-line. Do not load a large export into memory unless its size is known to be safe.

## Validate the stream before trusting it

The response is NDJSON: one JSON object per line. Every record has a leading `t` discriminator.

A successful stream has this structure:

```text
{"t":"manifest", ...}
{"t":"source", ...}
{"t":"event", ...}
{"t":"delivery_artifact", ...}
{"t":"network_observation", ...}
{"t":"convergence_run", ...}
{"t":"state_delta", ...}
{"t":"epoch_state_transition", ...}
{"t":"audit_data_mode_change", ...}
{"t":"eof","complete":true,"counts":{...}}
```

Reject the entire export unless all of these conditions hold:

1. The HTTP status is `200`.
2. The first record is `t == "manifest"`.
3. Every non-empty line parses as one JSON object.
4. The final record is `t == "eof"` with `complete == true`.
5. No `t == "error"` record appears.
6. Observed per-type counts agree with the terminal `counts` object.

A mid-stream failure appears as:

```json
{"t":"error","complete":false}
```

It has no terminal `eof`. Treat the response as incomplete and discard conclusions derived from it.

Handle initial failures as follows:

- `401`: missing, malformed, expired, inactive, or owner-disabled token; also verify that the credential begins with `gpat_`.
- `404`: unknown group or a group outside the reader’s scope. Do not distinguish these cases by probing.
- `503`: exports are temporarily disabled. Retry later with bounded backoff.
- HTML login redirect: the endpoint or deployment may not support bearer authentication on that route.

Authentication is checked before streaming starts. Revoking a token does not terminate an export already in progress.

## Understand the records

### `manifest`

Use the manifest to establish:

- Export schema version.
- Generation time.
- Group identity.
- Classification and sensitivity.
- Expected record sections.

Do not analyze records under an unknown schema version as though they matched this skill. Report the unsupported version and request updated documentation.

### `source`

A source represents one uploaded audit file and its provenance summary. It can include:

- Source name and analyst-facing label.
- Account, device, platform, and app-version labels.
- Validation status and validation error.
- Total, valid, invalid, duplicate, and group-event counts.
- Sequence and wall-time ranges.
- Account, engine, group, and schema-version summaries.
- Upload creation time.

Use source rows to evaluate evidence coverage before drawing conclusions.

Important limitations:

- A source with invalid events can still contain valid usable evidence.
- Structurally quarantined files may be excluded from trusted projections.
- The export does not contain raw upload bodies.
- Invalid counts or validation errors indicate evidence gaps that may require a human to inspect the original upload.

### `event`

An event represents one valid preserved audit-log event. It includes:

- Evidence identity: source file ID, line number, and line hash.
- Schema version.
- Per-recorder sequence number.
- Device wall-clock timestamp.
- Account, engine, and group references.
- Event type.
- Original event context and kind payload.
- Normalized fields used by Goggles projections.

Treat an event as the closest exported representation of source evidence.

Use:

- `seq` for ordering within the same recorder session.
- Source line number for ordering within one file.
- Epoch, commit, operation, and message relationships for causal reasoning.
- `wall_time_ms` as a timeline hint, not a cross-device ordering guarantee.

Device clocks can differ. Do not infer causality solely from timestamps across engines.

### `delivery_artifact`

A delivery artifact represents a message-like Marmot object. It may be:

- An application message.
- An MLS commit.
- An MLS proposal.
- A welcome.
- Group info.
- An unknown message-like artifact.

It can include:

- Canonical artifact or message ID.
- Artifact kind.
- Expected recipients.
- Per-engine observations and state trails.
- Recipient matrix.
- Decode and application-event information.
- Severity and evidence references.

Do not assume every delivery artifact is visible chat text.

Interpret recipient statuses carefully:

- `observed`: direct comparable evidence exists.
- `missing_inferred`: expected comparable evidence was not found.
- `unobserved_no_uploaded_engine`: the recipient lacks uploaded engine evidence.
- `observed_not_expected`: an engine observed an artifact outside the expected set.
- Count-based inferred statuses describe incomplete expectation/observation counts.

Missing evidence is not proof of non-delivery.

For welcomes, the newly added member expects the welcome while existing members generally receive the membership commit. Do not apply ordinary group-wide recipient expectations to welcomes.

### `network_observation`

A network observation describes transport-layer activity such as:

- Publish attempt.
- Publish outcome or failure.
- Relay acceptance or failure.
- Required acknowledgement count.
- Inbound transport receipt.
- Payload digest and length.
- Nostr, gift-wrap, welcome, or generic wire identifiers.

Keep transport identifiers separate from canonical Marmot artifact IDs.

A relay accepting a publication proves endpoint acceptance only. It does not prove:

- Device receipt.
- Decryption.
- Ingestion.
- Application visibility.
- Cross-relay propagation.
- Final delivery to every expected recipient.

Correlate network records with delivery observations and raw events before claiming delivery.

### `convergence_run`

A convergence run describes branch or fork evaluation for one group engine. It can include:

- Run lifecycle phase.
- Engine and epoch.
- Candidate branches and commit IDs.
- Eligibility and rejection reasons.
- Scores and witnesses.
- Rule evaluations and decisive rules.
- Selected and losing branches.
- Applied, stable, failed, blocked, or unrecoverable outcomes.
- Evidence references.

When `inferred == true`, Goggles reconstructed a provisional run because the engine did not emit a stable run ID. Treat inferred run boundaries with lower confidence.

Do not treat branch selection as successful recovery until evidence shows that the selected branch was applied and the engine returned to a stable state.

### `state_delta`

A state delta represents a durable group-state change, such as:

- Member added, removed, or left.
- Administrator added or removed.
- Group name, topic, avatar, or retention change.
- Another authenticated group-state update.

Use `origin_commit_id` to connect the state change to the MLS commit that caused it.

Separate:

- The user or system action that requested a change.
- The commit that encoded it.
- Network publication and delivery.
- Epoch confirmation.
- The resulting durable state delta.

### `epoch_state_transition`

An epoch transition describes MLS state-machine movement, such as:

- Pending or committed epoch.
- Confirmed epoch.
- Rolled-back epoch.
- Stable state.
- Failed or unrecoverable state.

Compare transitions across engines by epoch and commit identity. Do not assume that the engine with the latest timestamp necessarily has the authoritative branch.

### `audit_data_mode_change`

An audit-data-mode change marks a recorder visibility boundary. It can include:

- Previous and new audit mode.
- Reason for the change.
- Recorder restart status.
- Recorder session ID.
- Evidence reference.

Relevant modes include:

- `obfuscated_sensitive_data`: identifiers and decrypted content may be reduced or omitted.
- `full_data`: records may include decrypted content, complete author identifiers, and transport wire IDs.

Use these boundaries to explain why evidence detail changes during an investigation. Absence of decoded content in obfuscated mode is expected and is not evidence of a decryption failure.

## Correlate identifiers correctly

Keep these identity layers distinct:

- Group slug: Goggles API routing identifier.
- Group reference: Marmot group identity used in audit records.
- Artifact/message ID: canonical Marmot identity for an application message, commit, proposal, welcome, or group info.
- Transport ID: Nostr event, gift-wrap, welcome-rumor, key-package tag, or another wire identifier.
- Engine ID: one account-device engine.
- Account reference: stable obfuscated account identity.
- Operation ID: one user or system operation.
- Convergence run and branch IDs: fork-resolution identities.

Do not substitute one identity layer for another merely because two records occur near the same time.

## Investigation workflow

### 1. Define the question

Identify the smallest useful scope:

- Exact group.
- Time window.
- Relevant engines or accounts.
- Message, commit, welcome, operation, epoch, or convergence run.
- Reported symptom.

Avoid beginning with a broad dump of every sensitive field.

### 2. Establish evidence coverage

Before analyzing the symptom, inspect:

- Source validation statuses.
- Invalid and duplicate counts.
- Uploaded engines and accounts.
- Source time and sequence ranges.
- Audit modes and mode-change boundaries.
- Missing device uploads.
- Recorder restarts or health events.

State evidence gaps explicitly.

### 3. Start from intent when available

Look for `human_action` events and operation IDs to determine what a person or system requested.

Then follow:

```text
human action
  → generated artifact or commit
  → publish attempt/outcome
  → relay acknowledgements
  → transport receipt
  → ingest/decode outcome
  → epoch or group-state change
  → convergence/stability result
```

Not every investigation has every stage.

### 4. Correlate across engines

Build indexes by:

- Artifact/message ID.
- Origin commit ID.
- Operation ID.
- Engine ID.
- Epoch.
- Convergence run and branch.
- Specific transport identifiers.

Compare observations only where uploaded engine coverage is comparable.

### 5. Separate facts from inference

Classify every conclusion as:

- **Direct observation:** explicitly present in an event or projection.
- **Derived correlation:** supported by identifiers and multiple observations.
- **Inference:** likely explanation with incomplete evidence.
- **Unknown:** evidence is absent, quarantined, obfuscated, or outside uploaded coverage.

Never promote an inference to a direct fact.

### 6. Trace important findings to evidence

For every material finding, retain the smallest sufficient evidence pointer:

```text
source file ID
line number
line hash
event ID or type
engine ID
relevant artifact/run/epoch ID
```

Prefer evidence pointers and concise paraphrases over reproducing raw decrypted content.

### 7. Re-export when consistency matters

The streaming export is append-time-consistent, not one atomic database snapshot. Each section may be read in a separate transaction.

If a later projection refers to an event absent from an earlier section, or the group is actively receiving uploads:

1. Finish and validate the current stream.
2. Wait briefly if appropriate.
3. Fetch a fresh complete export.
4. Compare generation times and record counts.
5. Report any remaining cross-section mismatch.

## Diagnostic heuristics

### Delivery failure

Check in order:

1. Was an artifact generated?
2. Who was expected to receive it?
3. Was publication attempted?
4. Were required relay acknowledgements met?
5. Did another engine observe transport receipt?
6. Did ingest or peeling succeed?
7. Was content decoded?
8. Did message state become failed, deferred, or invalidated?
9. Is the recipient engine’s audit file present?
10. Did audit mode hide the expected detail?

Do not equate publish success with end-to-end delivery.

### Decryption or stale-epoch failure

Correlate:

- Transport receipt.
- Ingest entry and outcome.
- Peeler outcome.
- Rejection or message-state change.
- Engine epoch at receipt.
- Relevant commit and epoch transitions.
- Convergence or fork-recovery activity.

Distinguish malformed payload, missing state, stale epoch, and transport failure.

### Fork or convergence problem

For every affected engine, identify:

- Starting and tip epoch.
- Candidate branches.
- Eligibility and rejection reasons.
- Decisive rule.
- Selected branch.
- Whether selection was applied.
- Whether the engine became stable.
- Losing branch evidence.
- Any rollback, failed, blocked, or unrecoverable transition.

Treat inferred runs and clock-based ordering cautiously.

### Membership or group-state discrepancy

Follow:

```text
requested action
  → proposal or commit
  → publication
  → commit receipt
  → epoch confirmation
  → state delta
```

For added members, analyze the membership commit and welcome separately.

### Missing evidence

Before describing something as missing, ask:

- Was the relevant engine uploaded?
- Does its source cover the relevant time and sequence?
- Was the file structurally quarantined?
- Did audit mode suppress sensitive fields?
- Is the expected identifier from the correct identity layer?
- Could the event be in a later upload or recorder session?

Phrase the result as an evidence gap unless direct failure evidence exists.

## Report findings

Use this structure:

```markdown
## Finding

One-sentence conclusion.

- Direct evidence:
  - concise observation with source and line reference
- Correlated evidence:
  - related artifact, network, epoch, state, or convergence records
- Interpretation:
  - what the combined evidence supports
- Confidence:
  - high, medium, or low
- Evidence gaps:
  - missing engines, invalid files, obfuscated intervals, or incomplete coverage
- Next step:
  - smallest additional log, upload, or check needed
```

Lead with operationally relevant failures:

- Invalid or quarantined audit input.
- Explicit publish, ingest, peel, decode, state, or convergence failures.
- Unrecoverable or persistently unstable epochs.
- Recipient mismatches with comparable engine coverage.
- Fork-selection or application failures.
- Recorder/audit-mode gaps that prevent a reliable conclusion.

Avoid dumping all identifiers or decoded content into the final response. Reveal only what the authorized user needs.

## Preserve forensic integrity

Never modify audit records or fabricate missing evidence.

Do not claim that:

- An absent observation proves non-delivery.
- A relay acknowledgement proves device receipt.
- Timestamps provide a global causal order.
- An inferred convergence run has authoritative boundaries.
- A projection replaces its underlying evidence.
- A stream is complete without a valid terminal `eof`.
- An obfuscated interval should contain full decoded content.
- A structurally quarantined source can support trusted attribution.

When the evidence cannot establish the answer, say so and identify the exact additional evidence required.
