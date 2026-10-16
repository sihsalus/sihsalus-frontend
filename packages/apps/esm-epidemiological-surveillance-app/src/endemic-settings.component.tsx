import {
  Button,
  InlineLoading,
  InlineNotification,
  Modal,
  TextInput,
} from "@carbon/react";
import { ChartLine } from "@carbon/react/icons";
import { openmrsFetch } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiBase, read, safeError } from "./api";
import { ConfigurationTile } from "./configuration-tile.component";
import { ErrorNotification } from "./error-notification.component";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";

export function EndemicSettings({
  onSaved,
  currentYear,
}: {
  onSaved: () => void;
  currentYear: number;
}) {
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
      void read<number[]>(
        `${apiBase}/configuration/endemic-channel`,
        abort.signal,
      )
        .then((data) => {
          if (!abort.signal.aborted) setValues(data.map(String));
        })
        .catch((reason) => {
          if (!abort.signal.aborted) setError(reason);
        });
    return () => abort.abort();
  }, [open, retry]);
  const valid =
    !!values &&
    values.every((value) => /^\d+$/.test(value) && Number(value) >= 1) &&
    Number(values[0]) < currentYear &&
    Number(values[1]) <= Number(values[0]);
  const submit = async () => {
    if (!valid || busy || !values) return;
    setBusy(true);
    setError(undefined);
    try {
      await openmrsFetch(`${apiBase}/configuration/endemic-channel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values.map(Number)),
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
        icon={<ChartLine size={32} />}
        onClick={() => setOpen(true)}
      >
        {t("endemic.configure")}
      </ConfigurationTile>
      {saved && (
        <InlineNotification
          className={styles.configurationFeedback}
          kind="success"
          title={t("endemic.saved")}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}
      {open && (
        <Modal
          open
          modalHeading={t("endemic.configure")}
          primaryButtonText={t("save")}
          secondaryButtonText={t("cancel")}
          primaryButtonDisabled={!valid || busy}
          onRequestSubmit={submit}
          onRequestClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>{t("endemic.settingsHelp")}</p>
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
              {["historicalYears", "minimumYears"].map((key, index) => (
                <TextInput
                  key={key}
                  id={`endemic-${key}`}
                  type="number"
                  min={1}
                  max={index === 0 ? currentYear - 1 : Number(values[0])}
                  step={1}
                  disabled={busy}
                  labelText={t(`endemic.${key}`)}
                  value={values[index]}
                  onChange={(event) =>
                    setValues(
                      values.map((value, i) =>
                        i === index ? event.target.value : value,
                      ),
                    )
                  }
                />
              ))}
              {!valid && (
                <p role="alert">{t("errors.INVALID_ENDEMIC_SETTINGS")}</p>
              )}
            </div>
          )}
          {busy && <InlineLoading description={t("saving")} />}
        </Modal>
      )}
    </>
  );
}
