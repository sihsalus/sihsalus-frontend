import {
  Button,
  InlineLoading,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from "@carbon/react";
import { useSession } from "@openmrs/esm-framework";
import { RequirePrivilege } from "@sihsalus/esm-rbac";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCatalogue } from "./api";
import { CaseForm } from "./case-form.component";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  moduleName,
  reportPrivilege,
} from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { PendingCases } from "./pending-cases.component";
import { ReportPanel } from "./report-panel.component";
import type { CaseRequest, Catalogue } from "./types";
import styles from "./dashboard.scss";

export default function Dashboard() {
  const session = useSession();
  return (
    <SessionDashboard
      key={session?.authenticated ? session?.user?.uuid : "anonymous"}
    />
  );
}

// Patient selections and pending drafts belong to a single authenticated session.
function SessionDashboard() {
  const { t } = useTranslation(moduleName);
  const session = useSession();
  const [catalogue, setCatalogue] = useState<Catalogue>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [initial, setInitial] = useState<CaseRequest>();
  const [formKey, setFormKey] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry and session identity must invalidate the catalogue even when authentication stays true.
  useEffect(() => {
    const abort = new AbortController();
    setCatalogue(undefined);
    setError(undefined);
    if (!session?.authenticated) return;
    void getCatalogue(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) setCatalogue(value);
      })
      .catch((failure) => {
        if (!abort.signal.aborted) setError(failure);
      });
    return () => abort.abort();
  }, [session?.authenticated, session?.user?.uuid, retry]);
  return (
    <main className={styles.container}>
      <h1>
        {t("epidemiologicalSurveillance", "Epidemiological Surveillance")}
      </h1>
      <p>
        {t(
          "surveillanceDescription",
          "Register cases and review epidemiological indicators.",
        )}
      </p>
      {error ? (
        <>
          <ErrorNotification error={error} />
          <Button
            kind="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("retry", "Retry")}
          </Button>
        </>
      ) : !catalogue ? (
        <InlineLoading description={t("loading", "Loading")} />
      ) : (
        <Tabs>
          <TabList
            aria-label={t(
              "epidemiologicalSurveillance",
              "Epidemiological Surveillance",
            )}
          >
            <Tab>{t("cases", "Cases")}</Tab>
            <Tab>{t("indicators", "Indicators")}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <RequirePrivilege privilege={caseViewPrivilege}>
                <RequirePrivilege privilege={caseRegisterPrivilege}>
                  <div className={styles.actions}>
                    <Button
                      kind="tertiary"
                      onClick={() => {
                        setInitial(undefined);
                        setFormKey((value) => value + 1);
                      }}
                    >
                      {t("newCase", "New case")}
                    </Button>
                  </div>
                  <CaseForm
                    key={String(session?.user?.uuid) + ":" + formKey}
                    catalogue={catalogue}
                    initial={initial}
                    onSaved={() => setRevision((value) => value + 1)}
                  />
                  <PendingCases
                    catalogue={catalogue}
                    revision={revision}
                    onReview={(request) => {
                      setInitial(request);
                      setFormKey((value) => value + 1);
                    }}
                  />
                </RequirePrivilege>
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <ReportPanel catalogue={catalogue} />
              </RequirePrivilege>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </main>
  );
}
