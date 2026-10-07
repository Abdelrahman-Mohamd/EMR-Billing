import { createFileRoute, Outlet } from '@tanstack/react-router'

/** Visits: the list, a new visit, and one visit with its charge lines and claims. */
export const Route = createFileRoute('/_app/visits')({ component: Outlet })
