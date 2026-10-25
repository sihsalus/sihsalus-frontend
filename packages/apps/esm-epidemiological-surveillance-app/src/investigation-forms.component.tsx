import { Button, InlineNotification, Link, Search, Tile } from "@carbon/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import {
  fetchInvestigationForm,
  investigationForms,
} from "./investigation-forms";
import { downloadBlob } from "./report-export";
import styles from "./investigation-forms.scss";

export function InvestigationFormsPanel() {
  const { t } = useTranslation(moduleName);
  const [query, setQuery] = useState("");
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filtered = investigationForms.filter((form) => {
    const text = normalize(
      `${t(`investigationForms.${form.id}.name`)} ${t(`investigationForms.${form.id}.description`)}`,
    );
    return terms.every((term) => text.includes(term));
  });
  return (
    <section
      className={styles.panel}
      aria-labelledby="investigation-forms-title"
    >
      <h2 id="investigation-forms-title">{t("investigationForms.title")}</h2>
      <p>{t("investigationForms.description")}</p>
      <Search
        id="investigation-forms-search"
        labelText={t("investigationForms.search")}
        placeholder={t("investigationForms.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p role="status">
        {t("investigationForms.results", { count: filtered.length })}
      </p>
      {filtered.length === 0 && <p>{t("investigationForms.empty")}</p>}
      <div className={styles.grid}>
        {filtered.map((form) => (
          <FormCard key={form.id} form={form} />
        ))}
      </div>
    </section>
  );
}

function FormCard({ form }: { form: (typeof investigationForms)[number] }) {
  const { t } = useTranslation(moduleName);
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = t(`investigationForms.${form.id}.name`);
  const download = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const blob = await fetchInvestigationForm(form.url);
      downloadBlob(blob, `ficha-investigacion-${form.id}.pdf`);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <Tile className={styles.card}>
      <h3>{name}</h3>
      <p>{t(`investigationForms.${form.id}.description`)}</p>
      {form.regulation && <p>{form.regulation}</p>}
      <div className={styles.actions}>
        <Button
          kind="tertiary"
          size="sm"
          disabled={loading}
          aria-label={t("investigationForms.downloadNamed", { name })}
          onClick={() => void download()}
        >
          {t(
            loading
              ? "investigationForms.downloading"
              : "investigationForms.download",
          )}
        </Button>
        <Link href={form.source} target="_blank" rel="noopener noreferrer">
          {t("investigationForms.source")}
        </Link>
      </div>
      {failed && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t("investigationForms.failed")}
          subtitle={t("investigationForms.retry")}
        />
      )}
    </Tile>
  );
}
