import { Button, InlineLoading, Search } from "@carbon/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { searchInfectionAddresses } from "./infection-address.resource";
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
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<NamedReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Explicit retry reloads the same search.
  useEffect(() => {
    const abort = new AbortController();
    setItems([]);
    setError(undefined);
    setLoading(!value && query.trim().length >= 3);
    if (value || query.trim().length < 3) return () => abort.abort();
    const timer = setTimeout(() => {
      void searchInfectionAddresses(query, abort.signal)
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
  }, [query, value, retry]);

  const reset = () => {
    setQuery("");
    setItems([]);
    onChange("", "");
  };
  const choose = (item: NamedReference) => {
    setQuery("");
    setItems([]);
    onChange(item.uuid, item.display);
  };
  return (
    <fieldset className={styles.selector}>
      <legend>{t("fields.infectionAddressUuid")}</legend>
      <p>{t("infectionHierarchyHelp")}</p>
      {value && (
        <div className={styles.selection}>
          <span>{display || t("infectionPreservedCenter")}</span>
          <Button kind="ghost" size="sm" onClick={reset}>
            {t("infectionChange")}
          </Button>
        </div>
      )}
      {!value && (
        <>
          <Search
            id="infection-address-search"
            labelText={t("infectionSearchAll")}
            placeholder={t("infectionSearchAll")}
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
            <ul className={styles.options} aria-label={t("infectionSearchAll")}>
              {items.map((item) => (
                <li key={item.uuid}>
                  <button type="button" onClick={() => choose(item)}>
                    {item.display}
                  </button>
                </li>
              ))}
              {!items.length && (
                <li>
                  {t(
                    query.trim().length < 3
                      ? "infectionTypeMore"
                      : "infectionNoResults",
                  )}
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </fieldset>
  );
}
