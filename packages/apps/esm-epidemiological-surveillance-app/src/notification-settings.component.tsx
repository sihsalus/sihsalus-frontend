import {
  Button,
  InlineLoading,
  InlineNotification,
  Modal,
  TextInput,
  Select,
  SelectItem,
} from "@carbon/react";
import { Time } from "@carbon/react/icons";
import { openmrsFetch } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiBase, read, safeError } from "./api";
import { ConfigurationTile } from "./configuration-tile.component";
import { ErrorNotification } from "./error-notification.component";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";

export function NotificationSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation(moduleName);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads persisted settings.
  useEffect(() => {
    const abort = new AbortController();
    setValues(undefined);
    setError(undefined);
    if (open)
      void read<number[]>(`${apiBase}/configuration/notification`, abort.signal)
        .then((data) => {
          if (!abort.signal.aborted)
            setValues([
              String(data[0]),
              `${String(data[1]).padStart(2, "0")}:${String(data[2]).padStart(2, "0")}`,
            ]);
        })
        .catch((reason) => {
          if (!abort.signal.aborted) setError(reason);
        });
    return () => abort.abort();
  }, [open, retry]);
  const valid =
    !!values &&
    /^[1-7]$/.test(values[0]) &&
    /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(values[1]);
  const submit = async () => {
    if (!valid || busy || !values) return;
    setBusy(true);
    setError(undefined);
    try {
      await openmrsFetch(`${apiBase}/configuration/notification`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          Number(values[0]),
          ...values[1].split(":").map(Number),
        ]),
      });
      setOpen(false);
      setSaved(true);
      onSaved();
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ConfigurationTile
        icon={<Time size={32} />}
        onClick={() => setOpen(true)}
      >
        {t("notificationSettings.configure")}
      </ConfigurationTile>
      {saved && (
        <InlineNotification
          className={styles.configurationFeedback}
          kind="success"
          title={t("notificationSettings.saved")}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}
      {open && (
        <Modal
          open
          modalHeading={t("notificationSettings.configure")}
          primaryButtonText={t("save")}
          secondaryButtonText={t("cancel")}
          primaryButtonDisabled={!valid || busy}
          onRequestSubmit={submit}
          onRequestClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>{t("notificationSettings.settingsHelp")}</p>
          {error ? (
            <>
              <ErrorNotification error={error} />
              {!values && (
                <Button onClick={() => setRetry((value) => value + 1)}>
                  {t("retry")}
                </Button>
              )}
            </>
          ) : null}
          {!values && !error && <InlineLoading description={t("loading")} />}
          {values && (
            <div className={styles.form}>
              <Select
                id="notification-weekday"
                labelText={t("notificationSettings.day")}
                value={values[0]}
                disabled={busy}
                onChange={(event) => setValues([event.target.value, values[1]])}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <SelectItem
                    key={day}
                    value={String(day)}
                    text={t(`notificationSettings.days.${day}`)}
                  />
                ))}
              </Select>
              <TextInput
                id="notification-time"
                type="time"
                step={60}
                labelText={t("notificationSettings.time")}
                disabled={busy}
                value={values[1]}
                onChange={(event) => setValues([values[0], event.target.value])}
              />
              {!valid && (
                <p role="alert">{t("errors.INVALID_NOTIFICATION_SETTINGS")}</p>
              )}
            </div>
          )}
          {busy && <InlineLoading description={t("saving")} />}
        </Modal>
      )}
    </>
  );
}
