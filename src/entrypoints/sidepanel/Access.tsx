import { useEffect, useState } from 'react';
import { t } from '@/core/i18n';
import { hasAllSites, requestAllSites } from '@/core/permissions';
import { IconButton } from '@/ui/components';
import { Icon } from '@/ui/icons';

/**
 * Shown when a picker started from the side panel could not reach the tab. Clicks in
 * the side panel do not grant `activeTab`, so the fix is either the toolbar icon or
 * opting in to all-sites access.
 */
export function AccessBanner({ onGranted, onDismiss }: { onGranted: () => void; onDismiss: () => void }) {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void hasAllSites().then(setGranted);
  }, []);

  if (granted === null) return null;

  return (
    <div className="banner banner-warn" role="alert">
      <Icon name="alert" />
      <div className="grow">
        {granted ? (
          <>
            <strong>{t('access_unreachable_title')}</strong>
            {t('access_unreachable_text')}
          </>
        ) : (
          <>
            <strong>{t('access_allow_title')}</strong>
            {t('access_allow_text')}
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => {
                  void requestAllSites().then((ok) => {
                    if (ok) onGranted();
                  });
                }}
              >
                {t('access_allow_all_sites')}
              </button>
            </div>
          </>
        )}
      </div>
      <IconButton icon="x" label={t('access_dismiss_label')} onClick={onDismiss} />
    </div>
  );
}
