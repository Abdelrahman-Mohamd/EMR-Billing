/**
 * Public surface of Setup → Release buckets. Routes and other features import
 * from here only (docs/FRONTEND_ARCHITECTURE.md §3). The Insurance form picks
 * a bucket from `useReleaseBuckets`.
 */
export { ReleaseBucketsScreen } from './components/ReleaseBucketsScreen'
export { useReleaseBuckets } from './queries/use-release-buckets'
export type { ReleaseBucket } from './schemas/release-bucket'
