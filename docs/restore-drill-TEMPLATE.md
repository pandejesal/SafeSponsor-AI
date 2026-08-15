# Restore Drill — <DATE>

## Purpose
Verify that a Firestore backup can actually be restored and that document
counts match, so the first real restore is not the first time we do it.

## Prerequisites
- [ ] GCP scheduled backup exists (Firebase console → Firestore → Backups), daily, 30-day retention
- [ ] `gcloud` CLI authenticated with access to the project
- [ ] `firebase-tools` installed (already in devDependencies)

## Steps
1. List available backups:
   ```
   gcloud firestore backups list --location=<region> --project=<project-id>
   ```
2. Pick the most recent completed backup id and restore into a **scratch** database
   (never overwrite production directly):
   ```
   gcloud firestore backups restore --backup=<backup-id> --database=scratch-restore-drill \
     --project=<project-id> --location=<region> --destination-database-name=scratch-restore-drill
   ```
3. Compare counts: run `npm run export:db`-style count queries against the scratch
   database and compare with the production export log (`backups/firestore-export-*.json`
   doc counts printed by `[EXPORT]` lines). Record totals per collection below.

## Verification Results
| Collection | Prod count (from export) | Scratch count (restored) | Match? |
|---|---|---|---|
| users |  |  |  |
| global_audits |  |  |  |
| usage_logs |  |  |  |
| takedown_tombstones |  |  |  |
| ... |  |  |  |

- [ ] All counts match (or documented delta with justification)
- [ ] Spot-check one `users/{uid}/history` subcollection exists with documents
- [ ] Scratch database deleted:
  ```
  gcloud firestore databases delete --database=scratch-restore-drill --project=<project-id>
  ```

## Sign-off
- Date completed:
- Restored backup id:
- Verified by: