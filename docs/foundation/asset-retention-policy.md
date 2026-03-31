# Phase 0 Task 4: Generated Image Retention Policy and Storage Lifecycle

Status: completed on 2026-03-29

This policy builds on the S3 storage strategy chosen in `docs/foundation/asset-storage-decision.md`.

Scope for this task:

- define the lifecycle for curated target images
- define the lifecycle for generated attempt images
- define how app records behave after generated image deletion

## Policy Summary

- target images are retained until content is intentionally replaced or removed
- noncurrent target-image versions may be deleted after 30 days to cap storage growth
- generated attempt images are retained for 90 days from creation, then hard-deleted by lifecycle rule
- attempt metadata, scores, prompts, and analytics references remain in the database after image deletion

## Target Image Lifecycle

- storage class: standard object storage
- retention: indefinite for the current canonical object
- versioning: enabled
- noncurrent version cleanup: delete noncurrent versions after 30 days

Why this fits:

- target images are curated product assets and should remain stable
- version history provides rollback protection when level art is replaced
- old versions do not need indefinite retention once a rollback window has passed

## Generated Image Lifecycle

- storage class: standard object storage only
- retention window: 90 days from upload time
- expiration action: hard delete after 90 days
- no archive transition in MVP

Why this fits:

- generated images must survive refresh, resume, replay, and short-horizon debugging
- the MVP uses anonymous progress, so indefinite retention of player-generated outputs is unnecessary
- small image objects do not justify adding cold-storage restore complexity during MVP

Inference from source material and product constraints:

- AWS documents the lifecycle mechanics, not a Pixel Prompt-specific retention duration
- the 90-day window is a product decision inferred from the MVP's anonymous-session scope and the need for short-term resume/history

## Database Behavior After Object Expiry

- attempt rows remain valid even after the generated image object expires
- expired image references should be marked as unavailable rather than treated as corrupt progress
- UX may still show score, prompt text, timing, and pass/fail history after the image itself is gone
- replay should create a new attempt image rather than trying to restore a deleted object

## Operational Rules

- lifecycle deletion is bucket-managed, not application-polled
- no transition to colder storage classes in MVP because retrieval latency and restore workflows add product complexity
- Task 5's anonymous session strategy must fit within this 90-day generated-image retention window

Sources:

- [Managing the lifecycle of objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [How S3 Versioning works](https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html)
