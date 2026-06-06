import { useQuery } from '@tanstack/react-query'
import type { BucketInfo } from '../../../shared/types/storage'

export function useBuckets(accountId: string | null): {
  buckets: BucketInfo[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
} {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['buckets', accountId],
    queryFn: () => window.api.listBuckets(accountId!),
    enabled: !!accountId
  })

  return {
    buckets: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch: () => void refetch()
  }
}
