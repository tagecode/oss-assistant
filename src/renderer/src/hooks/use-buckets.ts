import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BucketInfo } from '../../../shared/types/storage'

export function useBuckets(accountId: string | null): {
  buckets: BucketInfo[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
} {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['buckets', accountId],
    queryFn: async () => {
      try {
        return await window.api.listBuckets(accountId!)
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['accounts'] })
      }
    },
    enabled: !!accountId
  })

  return {
    buckets: data ?? [],
    isLoading,
    error: error as Error | null,
    refetch: () => void refetch()
  }
}
