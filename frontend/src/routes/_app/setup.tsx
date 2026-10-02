import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SectionLayout } from '@/app/layouts/SectionLayout'
import { SETUP_SECTION_GROUPS } from '@/app/layouts/setup-sections'

/**
 * Setup — the master data claims are built from — in its own module beside
 * Admin (client, 2026-09-30). Like Admin, it has no permission guard yet
 * (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export const Route = createFileRoute('/_app/setup')({
  component: () => (
    <SectionLayout label="Setup" groups={SETUP_SECTION_GROUPS}>
      <Outlet />
    </SectionLayout>
  ),
})
