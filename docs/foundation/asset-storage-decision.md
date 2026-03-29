# Phase 0 Task 3: Asset Storage Strategy

Status: completed on 2026-03-29

Verified against current official AWS S3 docs on 2026-03-29.

Scope for this task:

- choose how target images are stored
- choose how generated attempt images are stored
- choose the baseline access pattern for both asset classes

## Decision

- Provider: Amazon S3
- Strategy: two buckets with different access and lifecycle policies
  - target asset bucket: curated, versioned, effectively read-only in normal app flow
  - generated output bucket: private, write-heavy, lifecycle-managed

## Why S3

- S3 is a durable object store with standard tooling and a wide ecosystem
- S3 supports presigned URLs for time-limited access to private objects
- S3 Lifecycle rules can manage deletion and transitions over time
- S3 Versioning can preserve prior target-asset revisions if content is replaced by mistake

Sources:

- [Amazon S3 objects overview](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingObjects.html)
- [Sharing objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)
- [Managing the lifecycle of objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [How S3 Versioning works](https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html)

## Target Asset Bucket

- access: public through the app or CDN path, but write access remains restricted to deploy/content workflows
- versioning: enabled
- contents:
  - level target images
  - optional authored thumbnails or alternate crops for responsive UI

Why this fits:

- target images are curated product assets, not per-user uploads
- the app needs low-friction reads during gameplay
- versioning protects against accidental overwrites of canonical level art

## Generated Output Bucket

- access: private by default
- delivery: signed GET access or server-mediated asset URLs
- writes: server-side only in MVP
- contents:
  - generated images for scored attempts
  - optional derivative thumbnails if the UI later needs them

Why this fits:

- generated outputs are user-session artifacts, so privacy and lifecycle control matter more than public cacheability
- private-by-default storage prevents treating provider output URLs as durable public assets
- signed access supports resume, replay history, and debugging without making all generated outputs world-readable

## Inference And Tradeoff Notes

- choosing two buckets instead of one is an architectural inference from the S3 capabilities and the game's different read/write policies
- a single bucket with prefix-based rules would also work technically, but two buckets make lifecycle, IAM, and accidental-public-access mistakes easier to reason about in MVP
- this choice is about operational clarity, not raw feature necessity
