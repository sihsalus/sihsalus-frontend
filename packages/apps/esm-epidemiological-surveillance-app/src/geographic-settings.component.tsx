import {
  Button,
  InlineLoading,
  InlineNotification,
  Modal,
  TextInput,
} from "@carbon/react";
import { useEffect, useState } from "react";
import { Location, WarningAlt } from "@carbon/react/icons";
import { ConfigurationTile } from "./configuration-tile.component";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import {
  getRiskThresholds,
  importCoordinates,
  saveRiskThresholds,
  validRiskThresholds,
} from "./geographic.resource";
import styles from "./dashboard.scss";
import geoStyles from "./geographic.scss";

export function GeographicSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation(moduleName);
  const [mode, setMode] = useState<"risk" | "coordinates">();
  const [bounds, setBounds] = useState<string[]>();
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [saved, setSaved] = useState<string>();
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads persisted configuration.
  useEffect(() => {
    const abort = new AbortController();
    setError(undefined);
    setBounds(undefined);
    setCsv("");
    if (mode === "risk")
      void getRiskThresholds(abort.signal)
        .then((value) => {
          if (!abort.signal.aborted) setBounds(value.map(String));
        })
        .catch((reason) => {
          if (!abort.signal.aborted) setError(reason);
        });
    return () => abort.abort();
  }, [mode, retry]);
  const close = () => {
    if (!busy && !reading) setMode(undefined);
  };
  const valid =
    mode === "risk" ? !!bounds && validRiskThresholds(bounds) : !!csv;
  const submit = async () => {
    if (!valid || busy || reading || (mode === "risk" && !bounds)) return;
    setBusy(true);
    setError(undefined);
    try {
      if (mode === "risk") {
        await saveRiskThresholds((bounds ?? []).map(Number));
        setSaved(t("geo.riskSaved"));
      } else {
        const result = await importCoordinates(csv);
        setSaved(
          t("geo.coordinatesSaved", { count: result.imported }) +
            " " +
            t("geo.coordinatesPending", { count: result.pending ?? 0 }),
        );
      }
      setMode(undefined);
      onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ConfigurationTile
        icon={<Location size={32} />}
        onClick={() => setMode("coordinates")}
      >
        {t("geo.configureCoordinates")}
      </ConfigurationTile>
      <ConfigurationTile
        icon={<WarningAlt size={32} />}
        onClick={() => setMode("risk")}
      >
        {t("geo.configureRisk")}
      </ConfigurationTile>
      {saved && (
        <InlineNotification
          className={styles.configurationFeedback}
          kind="success"
          title={saved}
          onCloseButtonClick={() => setSaved(undefined)}
        />
      )}
      {mode && (
        <Modal
          open
          modalHeading={t(
            mode === "risk" ? "geo.configureRisk" : "geo.configureCoordinates",
          )}
          primaryButtonText={t("save")}
          secondaryButtonText={t("cancel")}
          primaryButtonDisabled={!valid || busy || reading}
          onRequestClose={close}
          onSecondarySubmit={close}
          onRequestSubmit={submit}
        >
          {error && <ErrorNotification error={error} />}
          {mode === "risk" ? (
            <>
              <p>{t("geo.riskHelp")}</p>
              {!bounds && !error && (
                <InlineLoading description={t("loading")} />
              )}
              {!bounds && error && (
                <Button onClick={() => setRetry((v) => v + 1)}>
                  {t("retry")}
                </Button>
              )}
              {bounds?.map((value, i) => (
                <TextInput
                  key={["MEDIUM", "HIGH", "VERY_HIGH"][i]}
                  id={`risk-bound-${i}`}
                  type="number"
                  min={2}
                  step={1}
                  disabled={busy}
                  labelText={t(
                    `geo.risk.${["MEDIUM", "HIGH", "VERY_HIGH"][i]}`,
                  )}
                  value={value}
                  onChange={(e) =>
                    setBounds((current) =>
                      current?.map((old, n) =>
                        n === i ? e.target.value : old,
                      ),
                    )
                  }
                />
              ))}
              {bounds && !valid && <p role="alert">{t("geo.invalidRisk")}</p>}
            </>
          ) : (
            <div className={geoStyles.csvUpload}>
              <p id="geo-csv-help">{t("geo.csvHelp")}</p>
              <label htmlFor="geo-csv">{t("geo.csvFile")}</label>
              <input
                id="geo-csv"
                aria-describedby="geo-csv-help"
                type="file"
                accept=".csv,text/csv"
                disabled={busy || reading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  setCsv("");
                  setError(undefined);
                  if (!file) return;
                  setReading(true);
                  try {
                    setCsv(await file.text());
                  } catch (reason) {
                    setError(reason);
                  } finally {
                    setReading(false);
                  }
                }}
              />
            </div>
          )}
          {(busy || reading) && <InlineLoading description={t("loading")} />}
        </Modal>
      )}
    </>
  );
}
