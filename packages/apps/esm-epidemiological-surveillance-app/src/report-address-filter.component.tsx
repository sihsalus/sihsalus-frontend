import { InlineLoading, Select, SelectItem } from "@carbon/react";
import { useEffect, useRef, useState } from "react";
import { locationAddressDefaults } from "./location-address.resource";
import { useTranslation } from "react-i18next";
import { addressChildren } from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { NamedReference, ReportZoneLevel } from "./types";

const levels = [
  "departments",
  "provinces",
  "districts",
  "populated-centers",
] as const;
const zones: ReportZoneLevel[] = [
  "DEPARTAMENTO",
  "PROVINCIA",
  "DISTRITO",
  "CENTRO_POBLADO",
];
const labels = [
  "reportDepartment",
  "reportProvince",
  "reportDistrict",
  "reportCenter",
];

export function ReportAddressFilter({
  idPrefix = "report",
  onChange,
  includeCenter = true,
  locationUuid,
}: {
  idPrefix?: string;
  includeCenter?: boolean;
  locationUuid?: string;
  onChange: (address: string, level: ReportZoneLevel) => void;
}) {
  const { t } = useTranslation(moduleName);
  const [selected, setSelected] = useState(["", "", "", ""]);
  const [options, setOptions] = useState<NamedReference[][]>([[], [], [], []]);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const edited = useRef(false);
  const changeRef = useRef(onChange);
  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const abort = new AbortController();
    edited.current = false;
    setSelected(["", "", "", ""]);
    changeRef.current("", "CENTRO_POBLADO");
    if (locationUuid) {
      void locationAddressDefaults(locationUuid, includeCenter, abort.signal)
        .then((result) => {
          if (abort.signal.aborted || edited.current) return;
          setSelected(result.selected);
          setOptions(result.options);
          const deepest = result.selected.reduce(
            (last, value, index) => (value ? index : last),
            -1,
          );
          changeRef.current(
            deepest < 0 ? "" : result.selected[deepest],
            deepest < 0 ? "CENTRO_POBLADO" : zones[deepest],
          );
        })
        .catch((failure) => {
          if (!abort.signal.aborted && !edited.current) setError(failure);
        });
    }
    return () => abort.abort();
  }, [locationUuid, includeCenter]);
  const [department, province, district] = selected;
  useEffect(() => {
    let active = true;
    setError(undefined);
    setLoading(true);
    void Promise.all([
      addressChildren("departments"),
      department
        ? addressChildren("provinces", department)
        : Promise.resolve([]),
      province ? addressChildren("districts", province) : Promise.resolve([]),
      district && includeCenter
        ? addressChildren("populated-centers", district)
        : Promise.resolve([]),
    ])
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch((failure) => {
        if (active) {
          setOptions([[], [], [], []]);
          setError(failure);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [department, province, district, includeCenter]);
  return (
    <>
      {levels.slice(0, includeCenter ? 4 : 3).map((level, index) => (
        <Select
          key={level}
          id={idPrefix + "-" + level}
          labelText={t(labels[index])}
          value={selected[index]}
          disabled={loading || (index > 0 && !selected[index - 1])}
          onChange={(event) => {
            edited.current = true;
            const next = selected.map((value, i) =>
              i < index ? value : i === index ? event.target.value : "",
            );
            setSelected(next);
            setOptions((current) =>
              current.map((items, i) => (i > index ? [] : items)),
            );
            const deepest = next.reduce(
              (last, value, i) => (value ? i : last),
              -1,
            );
            onChange(
              deepest < 0 ? "" : next[deepest],
              deepest < 0 ? "CENTRO_POBLADO" : zones[deepest],
            );
          }}
        >
          <SelectItem value="" text={t("reportAllLocations")} />
          {options[index].map((item) => (
            <SelectItem key={item.uuid} value={item.uuid} text={item.display} />
          ))}
        </Select>
      ))}
      {loading && <InlineLoading description={t("loading")} />}
      {error ? <ErrorNotification error={error} /> : null}
    </>
  );
}
