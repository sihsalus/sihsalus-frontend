import { Button, InlineLoading, Search } from "@carbon/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import {
  searchInfectionAddresses,
  type InfectionAddressLevel,
} from "./infection-address.resource";
import type { NamedReference } from "./types";
import styles from "./infection-address-selector.scss";

export function InfectionAddressSelector({
  value,
  display,
  onChange,
}: {
  value?: string;
  display?: string;
  onChange: (value: string, display?: string) => void;
}) {
  const { t } = useTranslation(moduleName);
  const [parents, setParents] = useState<NamedReference[]>([]);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NamedReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const parent = parents.at(-1)?.uuid ?? "";
  const level: InfectionAddressLevel =
    parents.length === 0
      ? "stateProvince"
      : parents.length === 1
        ? "countyDistrict"
        : "cityVillage";
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry reloads the same search.
  useEffect(() => {
    const abort = new AbortController();
    setItems([]);
    setError(undefined);
    setLoading(!value);
    if (value) return () => abort.abort();
    const timer = setTimeout(() => {
      void searchInfectionAddresses(level, parent, query, abort.signal)
        .then((next) => {
          if (!abort.signal.aborted) setItems(next);
        })
        .catch((failure) => {
          if (!abort.signal.aborted) setError(failure);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [level, parent, query, value, retry]);

  const reset = () => {
    setParents([]);
    setQuery("");
    setItems([]);
    onChange("", "");
  };
  const choose = (item: NamedReference) => {
    setQuery("");
    setItems([]);
    if (level === "cityVillage") onChange(item.uuid, item.display);
    else setParents((current) => [...current, item]);
  };
  return (
    <fieldset className={styles.selector}>
      <legend>{t("fields.infectionAddressUuid")}</legend>
      <p>{t("infectionHierarchyHelp")}</p>
      {(value || parents.length > 0) && (
        <div className={styles.selection}>
          <span>
            {value
              ? display || t("infectionPreservedCenter")
              : parents.at(-1)?.display}
          </span>
          <Button kind="ghost" size="sm" onClick={reset}>
            {t("infectionChange")}
          </Button>
        </div>
      )}
      {!value && (
        <>
          <Search
            id="infection-address-search"
            labelText={t(`infectionSearch.${level}`)}
            placeholder={t(`infectionSearch.${level}`)}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />
          {loading ? (
            <InlineLoading description={t("loading")} />
          ) : error ? (
            <>
              <ErrorNotification error={error} />
              <Button
                kind="tertiary"
                onClick={() => setRetry((current) => current + 1)}
              >
                {t("retry")}
              </Button>
            </>
          ) : (
            <ul
              className={styles.options}
              aria-label={t(`infectionSearch.${level}`)}
            >
              {items.map((item) => (
                <li key={item.uuid}>
                  <button type="button" onClick={() => choose(item)}>
                    {item.display}
                  </button>
                </li>
              ))}
              {!items.length && <li>{t("infectionNoResults")}</li>}
            </ul>
          )}
        </>
      )}
    </fieldset>
  );
}
