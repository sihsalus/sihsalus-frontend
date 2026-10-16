import {
  Button,
  InlineLoading,
  InlineNotification,
  TextInput,
  Modal,
} from "@carbon/react";
import { useEffect, useState } from "react";
import { UserMultiple } from "@carbon/react/icons";
import { ConfigurationTile } from "./configuration-tile.component";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { getAgeGroups, saveAgeGroups } from "./demographic.resource";
import type { AgeGroup } from "./demographic.types";
import { ErrorNotification } from "./error-notification.component";
import styles from "./dashboard.scss";

export function ageGroupsFromBounds(
  groups: AgeGroup[],
  bounds: string[],
): AgeGroup[] | undefined {
  if (groups.length !== 6 || bounds.length !== 5) return undefined;
  let min = 0;
  const result: AgeGroup[] = [];
  for (let i = 0; i < groups.length; i++) {
    const max = i === 5 ? null : Number(bounds[i]);
    if (
      max !== null &&
      (!/^\d+$/.test(bounds[i]) ||
        !Number.isSafeInteger(max) ||
        max < min ||
        max >= 2147483647)
    )
      return undefined;
    result.push({ key: groups[i].key, minAge: min, maxAge: max });
    if (max !== null) min = max + 1;
  }
  return result;
}

export function AgeGroupsPanel({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation(moduleName);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<AgeGroup[]>();
  const [bounds, setBounds] = useState<string[]>([]);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry repeats the same configuration request.
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setError(undefined);
    setGroups(undefined);
    void getAgeGroups(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setGroups(value);
          setBounds(value.slice(0, -1).map((g) => String(g.maxAge)));
        }
      })
      .catch((reason) => {
        if (!abort.signal.aborted) setError(reason);
      });
    return () => abort.abort();
  }, [open, retry]);
  const draft = groups && ageGroupsFromBounds(groups, bounds);
  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await saveAgeGroups(draft);
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
        icon={<UserMultiple size={32} />}
        onClick={() => setOpen(true)}
      >
        {t("configureAgeGroups")}
      </ConfigurationTile>
      {open && (
        <Modal
          open
          modalHeading={t("configureAgeGroups")}
          primaryButtonText={t("saveAgeGroups")}
          secondaryButtonText={t("cancel")}
          primaryButtonDisabled={!draft || busy}
          onRequestSubmit={save}
          onRequestClose={() => {
            if (!busy) setOpen(false);
          }}
          onSecondarySubmit={() => {
            if (!busy) setOpen(false);
          }}
        >
          <p>{t("ageGroupsCoverage")}</p>
          {error && (
            <>
              <ErrorNotification error={error} />
              <Button kind="ghost" onClick={() => setRetry((v) => v + 1)}>
                {t("retry")}
              </Button>
            </>
          )}
          {!groups && !error && <InlineLoading description={t("loading")} />}
          {groups && (
            <>
              <fieldset disabled={busy} className={styles.form}>
                <legend>{t("ageGroupsYears")}</legend>
                {groups.map((group, i) => (
                  <div className={styles.filters} key={group.key}>
                    <TextInput
                      id={`age-min-${group.key}`}
                      labelText={`${t(`ageGroups.${group.key}`)} · ${t("from")}`}
                      readOnly
                      value={
                        i === 0
                          ? "0"
                          : bounds[i - 1] === ""
                            ? "—"
                            : String(Number(bounds[i - 1]) + 1)
                      }
                    />
                    {i < 5 ? (
                      <TextInput
                        id={`age-max-${group.key}`}
                        type="number"
                        min={i === 0 ? 0 : Number(bounds[i - 1]) + 1}
                        step={1}
                        labelText={`${t(`ageGroups.${group.key}`)} · ${t("to")}`}
                        value={bounds[i]}
                        onChange={(e) =>
                          setBounds((current) =>
                            current.map((value, n) =>
                              n === i ? e.target.value : value,
                            ),
                          )
                        }
                      />
                    ) : (
                      <p>{t("ageGroupsNoUpperLimit")}</p>
                    )}
                  </div>
                ))}
              </fieldset>
              {!draft && (
                <InlineNotification
                  kind="error"
                  hideCloseButton
                  title={t("ageGroupsInvalid")}
                />
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
