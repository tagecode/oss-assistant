import { useInfiniteQuery } from '@tanstack/react-query'
import type { StorageObject } from '../../../shared/types/storage'

export function useObjects(
  accountId: string | null,
  bucket: string | null,
  prefix: string
): {
  objects: StorageObject[]
  isLoading: boolean
  isFetchingMore: boolean
  hasMore: boolean
  error: Error | null
  refetch: () => void
  loadMore: () => void
} {
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['objects', accountId, bucket, prefix],
      queryFn: ({ pageParam }) =>
        window.api.listObjects(accountId!, bucket!, prefix, pageParam as string | undefined),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextMarker : undefined),
      enabled: !!accountId && !!bucket
    })

  const objects = data?.pages.flatMap((page) => page.objects) ?? []

  return {
    objects,
    isLoading,
    isFetchingMore: isFetchingNextPage,
    hasMore: !!hasNextPage,
    error: error as Error | null,
    refetch: () => void refetch(),
    loadMore: () => void fetchNextPage()
  }
}
