import { useEffect, useState } from 'react'

/**
 * The value once it has stopped changing for `delay` ms — so a search box asks
 * the server once the user pauses, not on every key. An empty string comes
 * through at once: clearing a search shows the whole list without a wait.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return value === '' ? value : settled
}
