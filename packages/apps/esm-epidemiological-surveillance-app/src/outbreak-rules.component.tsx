import {
  Button,
  InlineLoading,
  InlineNotification,
  Modal,
  Select,
  SelectItem,
  TextInput,
} from "@carbon/react";
import { WarningAlt } from "@carbon/react/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfigurationTile } from "./configuration-tile.component";
import { ErrorNotification } from "./error-notification.component";
import { moduleName } from "./constants";
import {
  getOutbreakRules,
  saveOutbreakRules,
  newOutbreakRule,
  validOutbreakRules,
  outbreakOrigins,
  outbreakFocuses,
  type OutbreakRule,
  type OutbreakRuleType,
} from "./outbreak-rules.resource";
import styles from "./dashboard.scss";

export function OutbreakRulesSettings() {
  const { t } = useTranslation(moduleName);
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<OutbreakRule[]>();
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry repeats the configuration request.
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setRules(undefined);
    setError(undefined);
    void getOutbreakRules(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setRules(value);
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      });
    return () => abort.abort();
  }, [open, retry]);
  const valid = !!rules && validOutbreakRules(rules);
  const update = (index: number, patch: Partial<OutbreakRule>) =>
    setRules((current) =>
      current?.map((rule, n) => (n === index ? { ...rule, ...patch } : rule)),
    );
  const close = () => {
    if (!busy) setOpen(false);
  };
  const submit = async () => {
    if (!rules || !valid || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await saveOutbreakRules(rules);
      setOpen(false);
      setSaved(true);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <ConfigurationTile
        icon={<WarningAlt size={32} />}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {t("outbreakRules.configure")}
      </ConfigurationTile>
      {saved && (
        <InlineNotification
          className={styles.configurationFeedback}
          kind="success"
          title={t("outbreakRules.saved")}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}
      {open && (
        <Modal
          open
          modalHeading={t("outbreakRules.configure")}
          primaryButtonText={t("save")}
          secondaryButtonText={t("cancel")}
          primaryButtonDisabled={!valid || busy}
          onRequestSubmit={submit}
          onRequestClose={close}
          onSecondarySubmit={close}
        >
          <p>{t("outbreakRules.help")}</p>
          {error ? (
            <>
              <ErrorNotification error={error} />
              {!rules && (
                <Button onClick={() => setRetry((value) => value + 1)}>
                  {t("retry")}
                </Button>
              )}
            </>
          ) : null}
          {!rules && !error && <InlineLoading description={t("loading")} />}
          {rules && (
            <div className={styles.form}>
              {rules.map((rule, index) => (
                <fieldset key={rule.id} disabled={busy} className={styles.form}>
                  <legend>
                    {t("outbreakRules.rule", { number: index + 1 })}
                  </legend>
                  <Select
                    id={`outbreak-type-${rule.id}`}
                    labelText={t("outbreakRules.type")}
                    value={rule.type}
                    onChange={(event) =>
                      setRules(
                        rules.map((item, n) =>
                          n === index
                            ? newOutbreakRule(
                                item.id,
                                event.target.value as OutbreakRuleType,
                              )
                            : item,
                        ),
                      )
                    }
                  >
                    {(["THRESHOLD", "CONSECUTIVE", "FOCUS_CASES"] as const).map(
                      (type) => (
                        <SelectItem
                          key={type}
                          value={type}
                          text={t(`outbreakRules.types.${type}`)}
                        />
                      ),
                    )}
                  </Select>
                  {rule.type === "FOCUS_CASES" ? (
                    <>
                      <TextInput
                        id={`outbreak-min-${rule.id}`}
                        type="number"
                        min={0}
                        max={2147483646}
                        step={1}
                        labelText={t("outbreakRules.minimumCases")}
                        value={rule.minimumCases ?? ""}
                        onChange={(event) =>
                          update(index, {
                            minimumCases:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          })
                        }
                      />
                      <Select
                        id={`outbreak-origin-${rule.id}`}
                        labelText={t("outbreakRules.origin")}
                        value={rule.origin ?? ""}
                        onChange={(event) =>
                          update(index, { origin: event.target.value })
                        }
                      >
                        {outbreakOrigins.map((origin) => (
                          <SelectItem
                            key={origin}
                            value={origin}
                            text={t(`geo.origins.${origin}`)}
                          />
                        ))}
                      </Select>
                      <Select
                        id={`outbreak-focus-${rule.id}`}
                        labelText={t("outbreakRules.focus")}
                        value={rule.focus ?? ""}
                        onChange={(event) =>
                          update(index, { focus: event.target.value })
                        }
                      >
                        {outbreakFocuses.map((focus) => (
                          <SelectItem
                            key={focus}
                            value={focus}
                            text={t(`geo.classes.${focus}`)}
                          />
                        ))}
                      </Select>
                      <p>{t("outbreakRules.focusHelp")}</p>
                    </>
                  ) : (
                    <>
                      <TextInput
                        id={`outbreak-percentile-${rule.id}`}
                        type="number"
                        min={0}
                        max={100}
                        step="any"
                        labelText={t("outbreakRules.percentile")}
                        value={rule.percentile ?? ""}
                        onChange={(event) =>
                          update(index, {
                            percentile:
                              event.target.value === ""
                                ? null
                                : Number(event.target.value),
                          })
                        }
                      />
                      {rule.type === "CONSECUTIVE" && (
                        <TextInput
                          id={`outbreak-weeks-${rule.id}`}
                          type="number"
                          min={1}
                          max={53}
                          step={1}
                          labelText={t("outbreakRules.weeks")}
                          value={rule.weeks ?? ""}
                          onChange={(event) =>
                            update(index, {
                              weeks:
                                event.target.value === ""
                                  ? null
                                  : Number(event.target.value),
                            })
                          }
                        />
                      )}
                    </>
                  )}
                  <Button
                    kind="danger--tertiary"
                    disabled={busy}
                    onClick={() =>
                      setRules((current) =>
                        current?.filter((item) => item.id !== rule.id),
                      )
                    }
                  >
                    {t("outbreakRules.remove", { number: index + 1 })}
                  </Button>
                </fieldset>
              ))}
              {rules.length === 0 && <p>{t("outbreakRules.empty")}</p>}
              <Button
                kind="tertiary"
                disabled={busy}
                onClick={() =>
                  setRules([
                    ...rules,
                    newOutbreakRule(crypto.randomUUID(), "THRESHOLD"),
                  ])
                }
              >
                {t("outbreakRules.add")}
              </Button>
              {!valid && (
                <p role="alert">{t("errors.INVALID_OUTBREAK_RULES")}</p>
              )}
            </div>
          )}
          {busy && <InlineLoading description={t("saving")} />}
        </Modal>
      )}
    </>
  );
}
