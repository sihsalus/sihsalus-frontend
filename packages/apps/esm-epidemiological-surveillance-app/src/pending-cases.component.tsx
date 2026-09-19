import { Button, InlineNotification } from "@carbon/react";
import { useSession } from "@openmrs/esm-framework";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { pendingCases } from "./offline";
import type { CaseRequest, Catalogue } from "./types";
import styles from "./dashboard.scss";
export function PendingCases({
  catalogue,
  revision,
  onReview,
}: {
  catalogue: Catalogue;
  revision: number;
  onReview: (request: CaseRequest) => void;
}) {
  const { t } = useTranslation(moduleName);
  const session = useSession();
  const [items, setItems] = useState<
    { id?: number; content: CaseRequest; lastError?: unknown }[]
  >([]);
  const [error, setError] = useState<unknown>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: A successful save must refresh the queue immediately, before the polling interval.
  useEffect(() => {
    let active = true;
    const user = session?.user?.uuid;
    if (!user) {
      setItems([]);
      return;
    }
    const load = () =>
      pendingCases(user)
        .then((next) => {
          if (active) {
            setItems(next);
            setError(undefined);
          }
        })
        .catch((failure) => {
          if (active) setError(failure);
        });
    void load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session?.user?.uuid, revision]);
  if (error) return <ErrorNotification error={error} />;
  if (!items.length) return null;
  return (
    <section aria-label={t("pendingCases", "Pending cases")}>
      <InlineNotification
        kind="warning"
        lowContrast
        hideCloseButton
        title={t("pendingCases", "Pending cases")}
        subtitle={t(
          "pendingReview",
          "Review any rejected records. A pending case has not yet completed server validation.",
        )}
      />
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{t("fields.eventUuid")}</th>
            <th scope="col">{t("fields.onsetDate")}</th>
            <th scope="col">{t("actions", "Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.content.uuid}>
              <td>
                {
                  catalogue.events.find(
                    (event) => event.uuid === item.content.eventUuid,
                  )?.name
                }
              </td>
              <td>{item.content.onsetDate}</td>
              <td>
                <Button kind="ghost" onClick={() => onReview(item.content)}>
                  {t("review", "Review and register")}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
