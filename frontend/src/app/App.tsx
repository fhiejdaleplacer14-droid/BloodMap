import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from '../components/ui/Toaster'
import { TooltipProvider } from '../components/ui/Tooltip'
import { queryClient } from './queryClient'
import { ThemeProvider } from './theme/ThemeProvider'
import { router } from './router'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
