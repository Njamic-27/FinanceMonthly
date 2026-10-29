import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { canGoBack } from '@renderer/lib/history'

/**
 * Follows what main does on its own: payments it posted or reminders it showed on its timer
 * refresh every query, a clicked notification opens its screen, and the mouse's back button
 * goes back.
 */
export function useMainEvents(): void {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    const stopData = window.api.on('data:changed', () => {
      void queryClient.invalidateQueries()
    })
    const stopNavigate = window.api.on('app:navigate', (path) => navigate(path))
    const stopBack = window.api.on('app:back', () => {
      if (canGoBack()) void navigate(-1)
    })
    return () => {
      stopData()
      stopNavigate()
      stopBack()
    }
  }, [queryClient, navigate])
}
