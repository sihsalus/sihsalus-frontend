import { AlertAccess, AlertNotifications, AlertsPanel } from "./alerts-panel.component";
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
import { WeeklyRecordsPanel } from "./weekly-records.component";
import {
  caseRegisterPrivilege,
  caseViewPrivilege,
  managePrivilege,
  moduleName,
  reportPrivilege,
} from "./constants";
import { ErrorNotification } from "./error-notification.component";
import { EventsPanel } from "./events-panel.component";
import { InvestigationFormsPanel } from "./investigation-forms.component";
import { IndicatorsPanel } from "./indicators-panel.component";
import { NotificationSettings } from "./notification-settings.component";
import { ReportPanel } from "./report-panel.component";
import { EndemicSettings } from "./endemic-settings.component";
import { dateInZone } from "./case-form.utils";
import { demographicPeriodLabel } from "./demographic-period";
import { DemographicPanel } from "./demographic-panel.component";
import { OutbreakRulesSettings } from "./outbreak-rules.component";
import { AgeGroupsPanel } from "./age-groups.component";
import { GeographicPanel } from "./geographic-panel.component";
import { GeographicSettings } from "./geographic-settings.component";
import { TableSettings, useTableAppearance } from "./table-settings.component";
import { reloadSurveillancePage } from "./reload-surveillance";
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
  const tableAppearance = useTableAppearance(session?.user?.uuid);
  const [catalogue, setCatalogue] = useState<Catalogue>();
  const [error, setError] = useState<unknown>();
  const [retry, setRetry] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [showCaseForm, setShowCaseForm] = useState(false);
  const [geographicRevision, setGeographicRevision] = useState(0);
  const [indicatorRevision, setIndicatorRevision] = useState(0);
  const [temporalRevision, setTemporalRevision] = useState(0);
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
    <main className={styles.container} style={tableAppearance.style}>
      <AlertAccess><AlertNotifications /></AlertAccess>
      <h1>
        {t("epidemiologicalSurveillance", "Epidemiological Surveillance")}
      </h1>
      <p>
        {t(
          "surveillanceDescription",
          "Register cases and review epidemiological information.",
        )}
      </p>
      {catalogue && <CurrentEpidemiologicalWeek calendar={catalogue.catalog} />}
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
            <Tab>{t("weekly.title")}</Tab>
            <Tab>{t("temporalInformation")}</Tab>
            <Tab>{t("indicators", "Indicators")}</Tab>
            <Tab>{t("demographic.title")}</Tab>
            <Tab>{t("geographic")}</Tab>
            <Tab>{t("events", "Events")}</Tab>
            <Tab>{t("configuration")}</Tab>
            <Tab>{t("alertInbox.title")}</Tab>
            <Tab>{t("investigationForms.tab")}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <RequirePrivilege privilege={caseViewPrivilege}>
                <RequirePrivilege privilege={caseRegisterPrivilege}>
                  <CasesPanel
                    catalogue={catalogue}
                    revision={0}
                    onSaved={reloadSurveillancePage}
                    onNewCase={() => {
                      setFormKey((value) => value + 1);
                      setShowCaseForm(true);
                    }}
                  />
                  <Modal
                    open={showCaseForm}
                    modalHeading={t("newCase", "New case")}
                    passiveModal
                    onRequestClose={() => setShowCaseForm(false)}
                    size="lg"
                  >
                    <CaseForm
                      key={String(session?.user?.uuid) + ":" + formKey}
                      catalogue={catalogue}
                      onSaved={reloadSurveillancePage}
                    />
                  </Modal>
                </RequirePrivilege>
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <RequirePrivilege privilege={caseViewPrivilege}>
                  <WeeklyRecordsPanel catalogue={catalogue} />
                </RequirePrivilege>
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <ReportPanel
                  key={temporalRevision}
                  catalogue={catalogue}
                  locationUuid={session?.sessionLocation?.uuid}
                />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <IndicatorsPanel key={indicatorRevision} catalogue={catalogue} locationUuid={session?.sessionLocation?.uuid} />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <DemographicPanel
                  catalogue={catalogue}
                  locationUuid={session?.sessionLocation?.uuid}
                />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={reportPrivilege}>
                <GeographicPanel
                  key={geographicRevision}
                  locationUuid={session?.sessionLocation?.uuid}
                  catalogue={catalogue}
                />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={managePrivilege}>
                <EventsPanel
                  catalogue={catalogue}
                  onEventsChanged={reloadSurveillancePage}
                />
              </RequirePrivilege>
            </TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={managePrivilege}>
                <section
                  className={styles.configurationGrid}
                  aria-label={t("configuration")}
                >
                  <NotificationSettings onSaved={() => setIndicatorRevision((value) => value + 1)} />
                  <TableSettings {...tableAppearance} />
                  <AgeGroupsPanel onSaved={reloadSurveillancePage} />
                  <OutbreakRulesSettings />
                  <EndemicSettings
                    currentYear={Number(
                      dateInZone(catalogue.catalog.timezone).slice(0, 4),
                    )}
                    onSaved={() => setTemporalRevision((value) => value + 1)}
                  />
                  <GeographicSettings
                    onSaved={() => setGeographicRevision((value) => value + 1)}
                  />
                </section>
              </RequirePrivilege>
            </TabPanel>
            <TabPanel><AlertAccess><AlertsPanel /></AlertAccess></TabPanel>
            <TabPanel>
              <RequirePrivilege privilege={caseViewPrivilege}>
                <InvestigationFormsPanel />
              </RequirePrivilege>
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </main>
  );
}

function CurrentEpidemiologicalWeek({
  calendar,
}: {
  calendar: Catalogue["catalog"];
}) {
  const { t } = useTranslation(moduleName);
  const [today, setToday] = useState(() => dateInZone(calendar.timezone));
  useEffect(() => {
    const refresh = () => setToday(dateInZone(calendar.timezone));
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [calendar.timezone]);
  const week = demographicPeriodLabel(
    { key: today, label: today },
    "semana",
    calendar,
  ).replace(/^\d{4}-/, "");
  return (
    <p>
      {t("currentEpidemiologicalWeek", "Current epidemiological week")}: {week}
    </p>
  );
}
