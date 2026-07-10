import {
  Button,
  ButtonSkeleton,
  Checkbox,
  CheckboxSkeleton,
  Column,
  Form,
  FormGroup,
  Grid,
  Layer,
  SkeletonText,
  Stack,
  TextInput,
  TextInputSkeleton,
} from '@carbon/react';
import { ErrorState, showSnackbar } from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import { extractOclErrorMessage, isAbortError, isVersionDefinedInUrl } from '../utils';

import { deleteSubscription, updateSubscription, useSubscription } from './subscription.resource';
import styles from './subscription.scss';

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const Subscription: React.FC = () => {
  const { t } = useTranslation();
  const { mutate } = useSWRConfig();
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [token, setToken] = useState('');
  const [isSubscribedToSnapshot, setIsSubscribedToSnapshot] = useState(false);
  const [validationType, setValidationType] = useState<'NONE' | 'FULL'>('FULL');
  const [isSnapshotOptionDisabled, setIsSnapshotOptionDisabled] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);

  const { data: subscription, isLoading, error } = useSubscription();

  useEffect(() => {
    if (!isLoading && !error) {
      setSubscriptionUrl(subscription?.url || '');
      setToken(subscription?.token || '');
      setIsSubscribedToSnapshot(subscription?.subscribedToSnapshot || false);
      setValidationType(subscription?.validationType || 'FULL');
      setIsSnapshotOptionDisabled(subscription ? isVersionDefinedInUrl(subscription.url) : false);
      setValidationAttempted(false);
    }
  }, [isLoading, error, subscription]);

  const handleChangeSubscriptionUrl = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSubscriptionUrl(event.target.value);
    if (isVersionDefinedInUrl(event.target.value)) {
      setIsSnapshotOptionDisabled(true);
      setIsSubscribedToSnapshot(false);
    } else {
      setIsSnapshotOptionDisabled(false);
    }
  }, []);

  const handleChangeToken = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setToken(event.target.value);
  }, []);

  const handleChangeValidationType = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, { checked }: { checked: boolean; id: string }) => {
      setValidationType(checked ? 'NONE' : 'FULL');
    },
    [],
  );

  const handleChangeSubscriptionType = useCallback(
    (_event: React.ChangeEvent<HTMLInputElement>, { checked }: { checked: boolean; id: string }) => {
      setIsSubscribedToSnapshot(checked);
    },
    [],
  );

  const subscriptionUrlError = !subscriptionUrl.trim()
    ? t('fieldRequired', 'Field is required')
    : !isValidUrl(subscriptionUrl)
      ? t('invalidUrl', 'Enter a valid URL')
      : undefined;
  const tokenError = !token.trim() ? t('fieldRequired', 'Field is required') : undefined;

  const handleSubmit = useCallback(
    async (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      setValidationAttempted(true);

      if (subscriptionUrlError || tokenError) {
        return;
      }

      if (isSnapshotOptionDisabled && isSubscribedToSnapshot) {
        showSnackbar({
          title: t('validationError', 'Validation error'),
          kind: 'error',
          subtitle: t(
            'snapshotDisabledError',
            "You cannot subscribe to a SNAPSHOT if you've provided the collection version",
          ),
        });
        return;
      }

      const abortController = new AbortController();

      try {
        const updatedSubscription = {
          ...subscription,
          url: subscriptionUrl,
          token: token,
          validationType: validationType,
          subscribedToSnapshot: isSubscribedToSnapshot,
        };
        void mutate('/ws/rest/v1/openconceptlab/subscription?v=full', updatedSubscription, false);

        const response = await updateSubscription(updatedSubscription, abortController);
        void mutate('/ws/rest/v1/openconceptlab/subscription?v=full');

        if (response.ok) {
          showSnackbar({
            title: t('subscriptionSaved', 'Subscription saved'),
            kind: 'success',
            subtitle: t(
              response.status === 201 ? 'subscriptionCreated' : 'subscriptionUpdated',
              response.status === 201 ? 'Subscription created successfully' : 'Subscription updated successfully',
            ),
          });
        } else {
          showSnackbar({
            title: t('errorSavingSubscription', 'Error saving subscription'),
            kind: 'error',
            subtitle: extractOclErrorMessage(response, t),
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          showSnackbar({
            title: t('errorSavingSubscription', 'Error saving subscription'),
            kind: 'error',
            subtitle: t('networkError', 'A network error occurred — check your connection'),
          });
        }
      } finally {
        abortController.abort();
      }
    },
    [
      subscriptionUrl,
      subscriptionUrlError,
      token,
      tokenError,
      validationType,
      isSubscribedToSnapshot,
      isSnapshotOptionDisabled,
      subscription,
      t,
      mutate,
    ],
  );

  const handleCancel = useCallback(() => {
    setSubscriptionUrl(subscription?.url || '');
    setToken(subscription?.token || '');
    setIsSubscribedToSnapshot(subscription?.subscribedToSnapshot || false);
    setValidationType(subscription?.validationType || 'FULL');
    setIsSnapshotOptionDisabled(subscription ? isVersionDefinedInUrl(subscription.url) : false);
    setValidationAttempted(false);

    showSnackbar({
      title: t('changesCancelled', 'Changes cancelled'),
      kind: 'info',
      subtitle: t('cancelledChanges', 'Cancelled changes successfully'),
    });
  }, [subscription, t]);

  const handleUnsubscribe = useCallback(
    async (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();
      evt.stopPropagation();
      const abortController = new AbortController();

      try {
        const response = await deleteSubscription(subscription, abortController);
        void mutate('/ws/rest/v1/openconceptlab/subscription?v=full');

        if (response.status === 204) {
          setSubscriptionUrl('');
          setToken('');
          setIsSubscribedToSnapshot(false);
          setValidationType('FULL');
          setIsSnapshotOptionDisabled(false);
          setValidationAttempted(false);
          showSnackbar({
            title: t('unsubscribed', 'Unsubscribed'),
            kind: 'success',
            subtitle: t('subscriptionDeleted', 'Successfully unsubscribed'),
          });
        } else {
          showSnackbar({
            title: t('errorDeletingSubscription', 'Error deleting subscription'),
            kind: 'error',
            subtitle: extractOclErrorMessage(response, t),
          });
        }
      } catch (err) {
        if (!isAbortError(err)) {
          showSnackbar({
            title: t('errorDeletingSubscription', 'Error deleting subscription'),
            kind: 'error',
            subtitle: t('networkError', 'A network error occurred — check your connection'),
          });
        }
      } finally {
        abortController.abort();
      }
    },
    [subscription, t, mutate],
  );

  if (isLoading) {
    return (
      <Grid className={styles.grid}>
        <Column sm={4} md={8} lg={10}>
          <Form>
            <SkeletonText className={styles.productiveHeading03} />
            <Stack gap={5}>
              <TextInputSkeleton />
              <TextInputSkeleton />
              <FormGroup legendText={<SkeletonText width="75px" />} className={styles.formGroup}>
                <CheckboxSkeleton />
                <CheckboxSkeleton />
              </FormGroup>
            </Stack>
            <ButtonSkeleton />
            <ButtonSkeleton />
          </Form>
          <Form className={styles.unsubscribeForm}>
            <SkeletonText className={styles.productiveHeading03} />
            <SkeletonText className={styles.unsubscribeText} />
            <ButtonSkeleton />
          </Form>
        </Column>
      </Grid>
    );
  }

  if (error) {
    return <ErrorState headerTitle={t('subscription', 'Subscription')} error={error} />;
  }

  return (
    <Grid className={styles.grid}>
      <Column sm={4} md={8} lg={10}>
        <Form onSubmit={(evt) => void handleSubmit(evt)} noValidate>
          <h3 className={styles.productiveHeading03}>{t('setupSubscription', 'Setup Subscription')}</h3>
          <Stack gap={5}>
            <Layer>
              <TextInput
                id="subscriptionUrl"
                type="url"
                labelText={t('subscriptionUrl', 'Subscription URL')}
                placeholder="https://api.openconceptlab.org/orgs/organization-name/collections/dictionary-name"
                value={subscriptionUrl}
                onChange={handleChangeSubscriptionUrl}
                required
                invalid={validationAttempted && !!subscriptionUrlError}
                invalidText={subscriptionUrlError}
              />
            </Layer>
            <Layer>
              <TextInput
                id="apiToken"
                type="password"
                placeholder="••••••••••••••••••••••••••••••••••••••••••••••••"
                labelText={t('apiToken', 'Token')}
                value={token}
                onChange={handleChangeToken}
                required
                invalid={validationAttempted && !!tokenError}
                invalidText={tokenError}
              />
            </Layer>
            <FormGroup legendText={t('advancedOptions', 'Advanced Options')} className={styles.formGroup}>
              <Checkbox
                checked={isSubscribedToSnapshot}
                onChange={handleChangeSubscriptionType}
                labelText={t('subscribeToSnapshotText', 'Subscribe to SNAPSHOT versions (not recommended)')}
                id="isSubscribedToSnapshot"
                disabled={isSnapshotOptionDisabled}
              />
              <Checkbox
                checked={validationType === 'NONE'}
                onChange={handleChangeValidationType}
                labelText={t(
                  'disableValidationText',
                  'Disable validation (should be used with care for well curated collections or sources)',
                )}
                id="isValidationDisabled"
              />
            </FormGroup>
          </Stack>
          <Button kind="secondary" onClick={handleCancel}>
            {t('cancelButton', 'Cancel changes')}
          </Button>
          <Button kind="primary" type="submit">
            {t('subscribeButton', 'Save changes')}
          </Button>
        </Form>
        <Form onSubmit={(evt) => void handleUnsubscribe(evt)} className={styles.unsubscribeForm}>
          <h3 className={styles.productiveHeading03}>{t('unsubscribe', 'Unsubscribe')}</h3>
          <p className={styles.unsubscribeText}>
            {t(
              'unsubscribeInfo',
              'If you unsubscribe, no concepts will be deleted nor changed. All information about subscription will be deleted from your system.',
            )}
          </p>
          <Button kind="danger" type="submit" disabled={!subscription}>
            {t('unsubscribeButton', 'Unsubscribe')}
          </Button>
        </Form>
      </Column>
    </Grid>
  );
};

export default Subscription;
