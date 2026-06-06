import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountFormDialog } from '@/components/account/account-form-dialog'
import { renderWithProviders } from '../test-utils'
import type { AccountPublic } from '../../../src/shared/types/storage'

const existingAccount: AccountPublic = {
  id: 'acc-1',
  name: '七牛云生产',
  provider: 'qiniu',
  region: 'z0',
  bucketDomain: 'https://cdn.example.com',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-02T00:00:00.000Z',
  hasAccessKey: true,
  hasSecret: true,
  lastConnectionStatus: 'connected'
}

function renderDialog(
  overrides: Partial<{
    open: boolean
    account: AccountPublic | null
    onSave: ReturnType<typeof vi.fn>
    onTest: ReturnType<typeof vi.fn>
    onOpenChange: ReturnType<typeof vi.fn>
  }> = {}
): {
  onSave: ReturnType<typeof vi.fn>
  onTest: ReturnType<typeof vi.fn>
  onOpenChange: ReturnType<typeof vi.fn>
} {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const onTest = vi.fn().mockResolvedValue(undefined)
  const onOpenChange = vi.fn()

  renderWithProviders(
    <AccountFormDialog
      open={overrides.open ?? true}
      onOpenChange={overrides.onOpenChange ?? onOpenChange}
      account={overrides.account ?? null}
      onSave={overrides.onSave ?? onSave}
      onTest={overrides.onTest ?? onTest}
    />
  )

  return { onSave, onTest, onOpenChange }
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.clear(screen.getByLabelText('账户名称'))
  await user.type(screen.getByLabelText('账户名称'), '测试账户')
  await user.clear(screen.getByLabelText(/^Access Key ID/))
  await user.type(screen.getByLabelText(/^Access Key ID/), 'AKID_TEST')
  await user.clear(screen.getByLabelText(/^Secret Key/))
  await user.type(screen.getByLabelText(/^Secret Key/), 'SECRET_TEST')
  await user.clear(screen.getByLabelText(/Bucket 域名/))
  await user.type(screen.getByLabelText(/Bucket 域名/), 'https://cdn.example.com')
}

describe('AccountFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders add account title and form fields', () => {
    renderDialog()
    expect(screen.getByRole('heading', { name: '添加账户' })).toBeInTheDocument()
    expect(screen.getByLabelText('账户名称')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Access Key ID/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Secret Key/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^区域/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Bucket 域名/)).toBeInTheDocument()
  })

  it('renders edit account title with existing values', () => {
    renderDialog({ account: existingAccount })
    expect(screen.getByRole('heading', { name: '编辑账户' })).toBeInTheDocument()
    expect(screen.getByLabelText('账户名称')).toHaveValue('七牛云生产')
    expect(screen.getByLabelText(/^Access Key ID/)).toHaveValue('')
    expect(screen.getAllByPlaceholderText('留空则不修改')).toHaveLength(2)
  })

  it('shows validation errors for required fields', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('请输入账户名称')).toBeInTheDocument()
    expect(screen.getByText('请输入 Access Key ID')).toBeInTheDocument()
  })

  it('shows error when bucket domain is missing for qiniu', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('账户名称'), '新账户')
    await user.type(screen.getByLabelText(/^Access Key ID/), 'AKID_NEW')
    await user.type(screen.getByLabelText(/^Secret Key/), 'SECRET_NEW')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('请输入 Bucket 域名（下载文件需要）')).toBeInTheDocument()
  })

  it('allows saving edited qiniu account without re-entering bucket domain', async () => {
    const user = userEvent.setup()
    const { onSave } = renderDialog({ account: existingAccount })

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce()
    })
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '七牛云生产',
        provider: 'qiniu',
        region: 'z0'
      })
    )
  })

  it('shows error when secret key is missing on new account', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('账户名称'), '新账户')
    await user.type(screen.getByLabelText(/^Access Key ID/), 'AKID_NEW')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('请输入 Secret Key')).toBeInTheDocument()
  })

  it('calls onSave with form data and closes dialog', async () => {
    const user = userEvent.setup()
    const { onSave, onOpenChange } = renderDialog()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce()
    })
    expect(onSave).toHaveBeenCalledWith({
      name: '测试账户',
      provider: 'qiniu',
      accessKeyId: 'AKID_TEST',
      secretKey: 'SECRET_TEST',
      region: 'z0',
      endpoint: undefined,
      bucketDomain: 'https://cdn.example.com',
      pathStyleAccess: undefined
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onTest and shows success message', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockResolvedValue(undefined)
    renderDialog({ onTest })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: '测试连接' }))

    await waitFor(() => {
      expect(onTest).toHaveBeenCalledOnce()
    })
    expect(await screen.findByText('连接测试成功')).toBeInTheDocument()
  })

  it('shows error message when connection test fails', async () => {
    const user = userEvent.setup()
    const onTest = vi.fn().mockRejectedValue(new Error('凭证无效'))
    renderDialog({ onTest })

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: '测试连接' }))

    expect(await screen.findByText('凭证无效')).toBeInTheDocument()
  })

  it('does not show endpoint field for AWS S3 provider', () => {
    const awsAccount: AccountPublic = {
      ...existingAccount,
      id: 'acc-aws',
      name: 'AWS 生产',
      provider: 'aws-s3',
      bucketDomain: undefined
    }
    renderDialog({ account: awsAccount })

    expect(screen.queryByLabelText('Endpoint')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Bucket 域名/)).not.toBeInTheDocument()
  })

  it('shows endpoint field for s3-compatible provider', () => {
    const s3Account: AccountPublic = {
      ...existingAccount,
      id: 'acc-s3',
      name: 'MinIO',
      provider: 's3-compatible',
      endpoint: 'https://minio.example.com',
      bucketDomain: undefined
    }
    renderDialog({ account: s3Account })

    expect(screen.getByLabelText(/Endpoint/)).toBeInTheDocument()
  })

  it('shows region dropdown with default qiniu region', () => {
    renderDialog()
    expect(screen.getByLabelText(/^区域/)).toHaveTextContent('华东-浙江 (z0)')
  })

  it('shows bucket domain field for qiniu provider', () => {
    renderDialog({ account: existingAccount })

    expect(screen.getByLabelText(/Bucket 域名/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Endpoint')).not.toBeInTheDocument()
  })

  it('toggles secret key visibility', async () => {
    const user = userEvent.setup()
    renderDialog()

    const secretInput = screen.getByLabelText(/^Secret Key/)
    expect(secretInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: '显示' }))
    expect(secretInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: '隐藏' }))
    expect(secretInput).toHaveAttribute('type', 'password')
  })

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup()
    const { onOpenChange } = renderDialog()

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
