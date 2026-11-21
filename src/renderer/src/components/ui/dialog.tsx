import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>): React.JSX.Element {
  return <DialogPrimitive.Trigger {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>): React.JSX.Element {
  return <DialogPrimitive.Portal {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>): React.JSX.Element {
  return <DialogPrimitive.Close {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>): React.JSX.Element {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  header,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  header?: React.ReactNode
}): React.JSX.Element {
  return (
    <DialogPortal>
      <DialogOverlay />
      {/* 弹窗会覆盖自绘标题栏的拖拽区，必须声明 no-drag；否则真实鼠标点击弹窗顶部控件会被窗口拖拽命中测试吞掉。 */}
      <DialogPrimitive.Content
        className={cn(
          'window-no-drag fixed left-[50%] top-[50%] z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
          className
        )}
        {...props}
      >
        {/* 标题固定在滚动区域之外，滚动条从标题下方开始，不会穿过右上角的关闭按钮。 */}
        {header ? <div className="shrink-0 pb-4 pr-10">{header}</div> : null}
        {/* 内容超出窗口高度时只滚动正文，右上角关闭按钮保持可见。 */}
        {/* 焦点环绘制在控件边界外，滚动容器必须留出内边距，否则输入框左右两侧的焦点环会被 overflow 裁掉；负外边距保持内容原来的对齐位置。 */}
        <div
          data-dialog-scroll
          className="-m-1 grid min-h-0 gap-4 overflow-y-auto overscroll-contain p-1"
        >
          {children}
        </div>
        <DialogPrimitive.Close
          data-testid="dialog-close"
          className="absolute right-2 top-2 inline-flex size-8 cursor-pointer items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5 text-center sm:text-left', className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2', className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
}
