import {
  MenuButton,
  MenuItem,
  InlineLoading,
  InlineNotification,
} from "@carbon/react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import { downloadBlob, imageBlob, tableBlob, tableRows } from "./report-export";
import styles from "./report-export.scss";

export function ReportExport({
  kind,
  name,
  title,
  children,
}: {
  kind: "table" | "image";
  name: string;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation(moduleName);
  const target = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async (format: "xlsx" | "csv" | "png" | "jpg") => {
    if (!target.current || busy.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      let blob: Blob;
      if (format === "xlsx" || format === "csv") {
        const table = target.current.querySelector("table");
        if (!table) throw new Error("Missing table");
        blob = await tableBlob(tableRows(table), format);
      } else {
        blob = await imageBlob(target.current, format);
      }
      downloadBlob(
        blob,
        `${name}-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div className={styles.header}>
        <h3>{title}</h3>
        <MenuButton
          label={t("export.open")}
          kind="tertiary"
          size="sm"
          menuAlignment="bottom-end"
          disabled={loading}
        >
          {(kind === "table"
            ? (["xlsx", "csv"] as const)
            : (["png", "jpg"] as const)
          ).map((format) => (
            <MenuItem
              key={format}
              disabled={loading}
              onClick={() => void run(format)}
              label={t(`export.${format}`)}
            />
          ))}
        </MenuButton>
      </div>
      {loading && <InlineLoading description={t("export.preparing")} />}
      {failed && (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t("export.failed")}
          subtitle={t(kind === "image" ? "export.imageRetry" : "export.retry")}
        />
      )}
      <div ref={target} className={styles.content}>
        {children}
      </div>
    </div>
  );
}
