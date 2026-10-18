import { RouterProvider } from 'react-router'
import { Toaster } from '../components/ui/Toaster'
import { TooltipProvider } from '../components/ui/Tooltip'
import { ThemeProvider } from './theme/ThemeProvider'
import { router } from './router'

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
