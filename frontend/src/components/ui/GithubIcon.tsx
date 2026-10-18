import githubSvg from '../../assets/icons/github.svg'
import type { IconSize } from './icons'

type GithubIconProps = {
  size?: IconSize
  className?: string
}

/**
 * Icon/github (3:286). lucide-react 1.x no longer ships brand icons, so the
 * Figma asset is used as a mask and filled with currentColor — it recolours
 * with the theme exactly like the Lucide icons.
 */
export function GithubIcon({ size = 24, className }: GithubIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        flexShrink: 0,
        width: size,
        height: size,
        backgroundColor: 'currentColor',
        maskImage: `url("${githubSvg}")`,
        maskSize: '100% 100%',
        maskRepeat: 'no-repeat',
      }}
    />
  )
}
