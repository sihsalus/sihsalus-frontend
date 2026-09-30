import { InlineLoading, Select, SelectItem } from "@carbon/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addressChildren } from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { NamedReference, ReportZoneLevel } from "./types";

export function ReportAddressFilter({
  level,
  onChange,
}: {
  level: ReportZoneLevel;
  onChange: (address: string) => void;
}) {
  const { t } = useTranslation(moduleName);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [center, setCenter] = useState("");
  const [options, setOptions] = useState<NamedReference[][]>([[], [], []]);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setError(undefined);
    setLoading(true);
    void Promise.all([
      addressChildren("provinces"),
      province ? addressChildren("districts", province) : Promise.resolve([]),
      level === "CENTRO_POBLADO" && district
        ? addressChildren("populated-centers", district)
        : Promise.resolve([]),
    ])
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch((failure) => {
        if (active) {
          setOptions([[], [], []]);
          setError(failure);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [province, district, level]);
  return (
    <>
      <Select
        id="report-province"
        labelText={t("reportProvince")}
        value={province}
        disabled={loading}
        onChange={(event) => {
          setProvince(event.target.value);
          setDistrict("");
          setCenter("");
          setOptions([options[0], [], []]);
          onChange("");
        }}
      >
        <SelectItem value="" text={t("reportChooseProvince")} />
        {options[0].map((item) => (
          <SelectItem key={item.uuid} value={item.uuid} text={item.display} />
        ))}
      </Select>
      <Select
        id="report-district"
        labelText={t("reportDistrict")}
        value={district}
        disabled={!province || loading}
        onChange={(event) => {
          setDistrict(event.target.value);
          setCenter("");
          setOptions([options[0], options[1], []]);
          onChange(level === "DISTRITO" ? event.target.value : "");
        }}
      >
        <SelectItem
          value=""
          text={
            level === "DISTRITO"
              ? t("reportAllDistricts")
              : t("reportChooseDistrict")
          }
        />
        {options[1].map((item) => (
          <SelectItem key={item.uuid} value={item.uuid} text={item.display} />
        ))}
      </Select>
      {level === "CENTRO_POBLADO" && (
        <Select
          id="report-center"
          labelText={t("reportCenter")}
          value={center}
          disabled={!district || loading}
          onChange={(event) => {
            setCenter(event.target.value);
            onChange(event.target.value);
          }}
        >
          <SelectItem value="" text={t("reportAllCenters")} />
          {options[2].map((item) => (
            <SelectItem key={item.uuid} value={item.uuid} text={item.display} />
          ))}
        </Select>
      )}
      <p>{t("reportAddressHelp")}</p>
      {loading && <InlineLoading description={t("loading")} />}
      {error ? <ErrorNotification error={error} /> : null}
    </>
  );
}
