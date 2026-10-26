import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Follows what main does on its own: payments it posted or reminders it showed on its timer
 * refresh every query, and a clicked notification opens its screen.
 */
export function useMainEvents(): void {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    const stopData = window.api.on('data:changed', () => {
      void queryClient.invalidateQueries()
    })
    const stopNavigate = window.api.on('app:navigate', (path) => navigate(path))
    return () => {
      stopData()
      stopNavigate()
    }
  }, [queryClient, navigate])
}
