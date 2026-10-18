import { useTranslation } from 'react-i18next'
import { useTheme } from '../../app/theme/useTheme'
import type { ThemePreference } from '../../app/theme/theme'

const OPTIONS: ThemePreference[] = ['light', 'dark', 'system']

/** Theme picker for the internal reference pages (not a designed component). */
export function DevThemeSwitch() {
  const { t } = useTranslation()
  const { preference, setPreference } = useTheme()
  return (
    <fieldset className="flex items-center gap-4 rounded-md border border-default bg-surface px-4 py-2">
      <legend className="sr-only">{t('theme.label')}</legend>
      {OPTIONS.map((option) => (
        <label key={option} className="type-label-m flex items-center gap-2 text-primary">
          <input
            type="radio"
            name="theme"
            value={option}
            checked={preference === option}
            onChange={() => setPreference(option)}
          />
          {t(`theme.${option}`)}
        </label>
      ))}
    </fieldset>
  )
}
