import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SectionLayout } from '@/app/layouts/SectionLayout'
import { ADMIN_SECTION_GROUPS } from '@/app/layouts/admin-sections'

/**
 * Every Admin section renders inside the Admin section list. Admin access is
 * System Admin territory in the prototype; there is no permission model to
 * guard it with yet, so `beforeLoad` is left for when there is
 * (docs/FRONTEND_ARCHITECTURE.md §8).
 */
export const Route = createFileRoute('/_app/admin')({
  component: () => (
    <SectionLayout label="Admin" groups={ADMIN_SECTION_GROUPS}>
      <Outlet />
    </SectionLayout>
  ),
})
