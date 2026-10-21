import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { FormDialog } from '../../components/ui/FormDialog'
import { RadioGroup } from '../../components/ui/RadioGroup'
import { TextAreaField } from '../../components/ui/TextAreaField'
import { toast } from '../../components/ui/toast'
import type { ReportReason } from '../../lib/api/coordinator'
import { useReportRequest } from '../../lib/api/requests'

const REASONS: ReportReason[] = ['no_longer_needed', 'wrong_details', 'personal_information', 'suspicious', 'other']

/**
 * "Report a problem" (decision #94): goes to the coordinators for the
 * request's area. The owner never sees who reported it.
 */
export function ReportDialog({ requestId, open, onOpenChange }: { requestId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['explorer', 'common'])
  const report = useReportRequest()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [details, setDetails] = useState('')
  const [errors, setErrors] = useState<{ reason?: string; details?: string }>({})

  const close = (next: boolean) => {
    if (!next) {
      setReason('')
      setDetails('')
      setErrors({})
    }
    onOpenChange(next)
  }

  const submit = () => {
    const next = {
      reason: reason ? undefined : t('detail.report.reasonRequired'),
      details: reason === 'other' && !details.trim() ? t('detail.report.detailsRequired') : details.length > 500 ? t('detail.report.tooLong') : undefined,
    }
    setErrors(next)
    if (next.reason || next.details || !reason) return
    report.mutate(
      { id: requestId, reason, details: details.trim() },
      {
        onSuccess: (result) => {
          toast({ tone: 'success', title: t(result.duplicate ? 'detail.report.already' : 'detail.report.sent'), message: t('detail.report.sentBody') })
          close(false)
        },
        onError: () => toast({ tone: 'error', title: t('detail.report.failed'), message: t('detail.report.failedBody') }),
      },
    )
  }

  return (
    <FormDialog open={open} onOpenChange={close} icon="flag" title={t('detail.report.title')} description={t('detail.report.body')}>
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2" aria-describedby={errors.reason ? 'report-reason-error' : undefined}>
          <legend className="type-label-m mb-2 text-primary">{t('detail.report.reason')}</legend>
          <RadioGroup
            label={t('detail.report.reason')}
            value={reason}
            onValueChange={(v) => setReason(v as ReportReason)}
            options={REASONS.map((r) => ({ value: r, label: t(`detail.report.reasons.${r}`) }))}
          />
          {errors.reason && (
            <p id="report-reason-error" className="type-body-s text-status-critical">
              {errors.reason}
            </p>
          )}
        </fieldset>
        <TextAreaField
          label={t(reason === 'other' ? 'detail.report.detailsRequiredLabel' : 'detail.report.details')}
          helperText={t('detail.report.detailsHelp')}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxChars={500}
          charCount={details.length}
          error={errors.details}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            {t('common:actions.cancel')}
          </Button>
          <Button icon="send" onClick={submit} loading={report.isPending}>
            {t('detail.report.send')}
          </Button>
        </div>
      </div>
    </FormDialog>
  )
}
