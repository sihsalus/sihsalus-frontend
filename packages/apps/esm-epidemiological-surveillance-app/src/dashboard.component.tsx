import {
  Button,
  InlineLoading,
  Modal,
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
import { CasesPanel } from "./cases-panel.component";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  managePrivilege,
  moduleName,
  reportPrivilege,
} from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { EventsPanel } from "./events-panel.component";
import { ReportPanel } from "./report-panel.component";
import type { Catalogue } from "./types";
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
  const [formKey, setFormKey] = useState(0);
  const [showCaseForm, setShowCaseForm] = useState(false);
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
            <Tab>{t("events", "Events")}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <RequirePrivilege privilege={caseViewPrivilege}>
                <RequirePrivilege privilege={caseRegisterPrivilege}>
                  <CasesPanel catalogue={catalogue} revision={revision} onNewCase={() => { setFormKey((value) => value + 1); setShowCaseForm(true); }} />
                  <Modal open={showCaseForm} modalHeading={t("newCase", "New case")} passiveModal onRequestClose={() => setShowCaseForm(false)} size="lg">
                    <CaseForm key={String(session?.user?.uuid) + ":" + formKey} catalogue={catalogue} onSaved={() => { setRevision((value) => value + 1); setShowCaseForm(false); }} />
                  </Modal>
                </RequirePrivilege>
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <ReportPanel catalogue={catalogue} />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={managePrivilege}>
                <EventsPanel
                  catalogue={catalogue}
                  onEventsChanged={() => setRetry((value) => value + 1)}
                />
              </RequirePrivilege>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </main>
  );
}
