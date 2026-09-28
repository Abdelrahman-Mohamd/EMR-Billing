import { createFileRoute, Link } from '@tanstack/react-router'
import { env } from '@/lib/config/env'
import { PageContainer, PageHeader } from '@/components/shared/PageLayout'
import { KeyValue } from '@/components/ui/KeyValue'
import { Button } from '@/components/ui/Button'

export const Route = createFileRoute('/_app/')({
  component: FoundationPage,
})

/**
 * Temporary landing page: it exercises the shell, the tokens and the router
 * end to end, and is replaced by the first real screen. It contains no
 * billing content by design.
 */
function FoundationPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Frontend foundation"
        description="See which environment and data source this build is using."
        actions={
          import.meta.env.DEV ? (
            <Link to="/dev/ui">
              <Button variant="primary">Component showcase</Button>
            </Link>
          ) : null
        }
      />
      <KeyValue
        items={[
          { label: 'Environment', value: env.environment },
          {
            label: 'Data source',
            value: env.isLive ? env.apiBaseUrl : 'mock — no backend is configured yet',
          },
          { label: 'Start here', value: 'frontend/docs/FRONTEND_ARCHITECTURE.md' },
        ]}
      />
    </PageContainer>
  )
}
