import { Select, SelectItem, Modal, InlineNotification } from "@carbon/react";
import { useId, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { TextAlignLeft } from "@carbon/react/icons";
import { ConfigurationTile } from "./configuration-tile.component";
import { moduleName } from "./constants";
import styles from "./dashboard.scss";

const sizes = [12, 14, 16, 18, 20, 24];
const alignments = ["left", "center", "right"] as const;
type Alignment = (typeof alignments)[number];
export interface TableAppearance {
  headerSize: number;
  bodySize: number;
  headerAlign: Alignment;
  bodyAlign: Alignment;
}
const defaults: TableAppearance = {
  headerSize: 14,
  bodySize: 14,
  headerAlign: "left",
  bodyAlign: "left",
};
export function useTableAppearance(userUuid?: string) {
  const storageKey = `${moduleName}:table-appearance:${userUuid}`;
  const [value, setValue] = useState<TableAppearance>(() => {
    try {
      const saved = userUuid
        ? JSON.parse(localStorage.getItem(storageKey) ?? "null")
        : null;
      return {
        headerSize: sizes.includes(saved?.headerSize)
          ? saved.headerSize
          : defaults.headerSize,
        bodySize: sizes.includes(saved?.bodySize)
          ? saved.bodySize
          : defaults.bodySize,
        headerAlign: alignments.includes(saved?.headerAlign)
          ? saved.headerAlign
          : defaults.headerAlign,
        bodyAlign: alignments.includes(saved?.bodyAlign)
          ? saved.bodyAlign
          : defaults.bodyAlign,
      };
    } catch {
      return defaults;
    }
  });
  const [storageFailed, setStorageFailed] = useState(false);
  const update = (next: TableAppearance) => {
    try {
      if (userUuid) localStorage.setItem(storageKey, JSON.stringify(next));
      setValue(next);
      setStorageFailed(false);
      return true;
    } catch {
      setStorageFailed(true);
      return false;
    }
  };
  const style = {
    "--surveillance-header-size": `${value.headerSize}px`,
    "--surveillance-body-size": `${value.bodySize}px`,
    "--surveillance-header-align": value.headerAlign,
    "--surveillance-body-align": value.bodyAlign,
  } as CSSProperties;
  return { value, update, style, storageFailed };
}
export function TableSettings({
  value,
  update,
  storageFailed,
}: Pick<
  ReturnType<typeof useTableAppearance>,
  "value" | "update" | "storageFailed"
>) {
  const { t } = useTranslation(moduleName);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <ConfigurationTile
        icon={<TextAlignLeft size={32} />}
        onClick={() => {
          setDraft(value);
          setSaved(false);
          setOpen(true);
        }}
      >
        {t("tableSettings.title")}
      </ConfigurationTile>
      {saved && (
        <InlineNotification
          className={styles.configurationFeedback}
          kind="success"
          title={t("tableSettings.saved")}
          onCloseButtonClick={() => setSaved(false)}
        />
      )}
      {open && (
        <Modal
          open
          modalHeading={t("tableSettings.title")}
          primaryButtonText={t("save")}
          secondaryButtonText={t("cancel")}
          onRequestClose={() => setOpen(false)}
          onRequestSubmit={() => {
            if (update(draft)) {
              setOpen(false);
              setSaved(true);
            }
          }}
        >
          <p>{t("tableSettings.help")}</p>
          {["header", "body"].map((section: "header" | "body") => (
            <fieldset key={section} className={styles.tableSettingsFields}>
              <legend>{t(`tableSettings.${section}`)}</legend>
              <Select
                id={`${id}-${section}-size`}
                labelText={t("tableSettings.size")}
                value={draft[`${section}Size`]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [`${section}Size`]: Number(event.target.value),
                  })
                }
              >
                {sizes.map((size) => (
                  <SelectItem key={size} value={size} text={`${size} px`} />
                ))}
              </Select>
              <Select
                id={`${id}-${section}-align`}
                labelText={t("tableSettings.align")}
                value={draft[`${section}Align`]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    [`${section}Align`]: event.target.value,
                  })
                }
              >
                {alignments.map((alignment) => (
                  <SelectItem
                    key={alignment}
                    value={alignment}
                    text={t(`tableSettings.${alignment}`)}
                  />
                ))}
              </Select>
            </fieldset>
          ))}
          {storageFailed && (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={t("tableSettings.storageFailed")}
            />
          )}
        </Modal>
      )}
    </>
  );
}
