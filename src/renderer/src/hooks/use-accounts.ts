import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AccountInput, AccountPublic } from '../../../shared/types/storage'

export function useAccounts(): {
  accounts: AccountPublic[]
  isLoading: boolean
  error: Error | null
  createAccount: (input: AccountInput) => Promise<AccountPublic>
  updateAccount: (id: string, input: Partial<AccountInput>) => Promise<AccountPublic>
  deleteAccount: (id: string) => Promise<void>
  testConnection: (input: Partial<AccountInput>, accountId?: string) => Promise<void>
  refetch: () => void
} {
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => window.api.listAccounts()
  })

  const createMutation = useMutation({
    mutationFn: (input: AccountInput) => window.api.createAccount(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AccountInput> }) =>
      window.api.updateAccount(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.api.deleteAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] })
  })

  const testMutation = useMutation({
    mutationFn: ({ input, accountId }: { input: Partial<AccountInput>; accountId?: string }) =>
      window.api.testConnection(input, accountId)
  })

  return {
    accounts: data ?? [],
    isLoading,
    error: error as Error | null,
    createAccount: createMutation.mutateAsync,
    updateAccount: (id, input) => updateMutation.mutateAsync({ id, input }),
    deleteAccount: deleteMutation.mutateAsync,
    testConnection: (input, accountId) => testMutation.mutateAsync({ input, accountId }),
    refetch: () => void refetch()
  }
}
