import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PathBreadcrumbProps {
  bucket: string
  prefix: string
  onNavigate: (prefix: string) => void
}

export function PathBreadcrumb({
  bucket,
  prefix,
  onNavigate
}: PathBreadcrumbProps): React.JSX.Element {
  const segments = prefix ? prefix.replace(/\/$/, '').split('/') : []

  return (
    <div className="flex items-center gap-1 px-4 py-2 text-sm">
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onNavigate('')}>
        <Home className="size-3.5" />
        {bucket}
      </Button>
      {segments.map((seg, i) => {
        const path = segments.slice(0, i + 1).join('/') + '/'
        return (
          <div key={path} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onNavigate(path)}>
              {seg}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
