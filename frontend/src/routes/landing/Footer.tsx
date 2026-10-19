import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Logo } from '../../components/domain/Logo'
import { GithubIcon } from '../../components/ui/GithubIcon'
import { icons } from '../../components/ui/icons'

const REPOSITORY = 'https://github.com/fhiejdaleplacer14-droid/BloodMap'
const ExternalLink = icons['external-link']

const linkClass = 'type-body-m rounded-sm text-secondary hover:text-primary hover:underline'

/** Pages with no frame yet render as text, not dead links (decision #27). */
function Unlinked({ children }: { children: string }) {
  return <span className="type-body-m text-tertiary">{children}</span>
}

/** Footer (21:3873). */
export function Footer() {
  const { t } = useTranslation('landing')

  return (
    <footer className="border-t border-default bg-surface px-[clamp(16px,8vw,120px)] pt-16 pb-8">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <div className="flex gap-16 max-lg:flex-col max-lg:gap-10">
          <div id="about" className="flex w-[360px] max-w-full shrink-0 scroll-mt-20 flex-col gap-4">
            <Logo />
            <p className="type-body-m text-secondary">{t('footer.overview')}</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-8 max-sm:grid-cols-1">
            <nav aria-label={t('footer.product')} className="flex flex-col gap-3">
              <h2 className="type-overline text-tertiary">{t('footer.product')}</h2>
              <Link to="/requests" className={linkClass}>
                {t('footer.links.find')}
              </Link>
              <Link to="/#how-it-works" className={linkClass}>
                {t('footer.links.how')}
              </Link>
              <Link to="/#about" className={linkClass}>
                {t('footer.links.about')}
              </Link>
            </nav>
            <nav aria-label={t('footer.safetyPrivacy')} className="flex flex-col gap-3">
              <h2 className="type-overline text-tertiary">{t('footer.safetyPrivacy')}</h2>
              <Link to="/#safety" className={linkClass}>
                {t('footer.links.safety')}
              </Link>
              <Unlinked>{t('footer.links.privacy')}</Unlinked>
              <Unlinked>{t('footer.links.terms')}</Unlinked>
              <Unlinked>{t('footer.links.retention')}</Unlinked>
            </nav>
            <nav aria-label={t('footer.support')} className="flex flex-col gap-3">
              <h2 className="type-overline text-tertiary">{t('footer.support')}</h2>
              <Unlinked>{t('footer.links.contact')}</Unlinked>
              <Unlinked>{t('footer.links.report')}</Unlinked>
              <a href={`${REPOSITORY}#readme`} target="_blank" rel="noreferrer noopener" className={`${linkClass} inline-flex items-center gap-1.5`}>
                {t('footer.links.docs')}
                <ExternalLink aria-hidden size={14} />
                <span className="sr-only">{t('footer.external')}</span>
              </a>
              <a href={REPOSITORY} target="_blank" rel="noreferrer noopener" className={`${linkClass} inline-flex items-center gap-1.5`}>
                {t('footer.links.github')}
                <GithubIcon size={14} />
                <span className="sr-only">{t('footer.external')}</span>
              </a>
            </nav>
          </div>
        </div>
        <div className="flex justify-between gap-8 border-t border-default pt-6 text-tertiary max-lg:flex-col max-lg:gap-3">
          <p className="type-body-s max-w-[820px]">{t('footer.disclaimer')}</p>
          <p className="type-mono-s whitespace-nowrap">{t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
