import { Button, InlineLoading, Select, SelectItem } from "@carbon/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addressChildren } from "./api";
import { moduleName } from "./constants";
import { ErrorNotification } from "./error-notification.component";
import type { NamedReference } from "./types";

function useAddresses(
  level: Parameters<typeof addressChildren>[0],
  parent?: string,
) {
  const [items, setItems] = useState<NamedReference[]>([]);
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A user-requested retry must reload the same level and parent.
  useEffect(() => {
    let active = true;
    setItems([]);
    setError(undefined);
    setLoading(false);
    if (level !== "provinces" && !parent) return;
    setLoading(true);
    void addressChildren(level, parent)
      .then((values) => {
        if (active) setItems(values);
      })
      .catch((failure) => {
        if (active) setError(failure);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [level, parent, retry]);
  return { items, error, loading, retry: () => setRetry((value) => value + 1) };
}

export function InfectionAddressSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation(moduleName);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const provinces = useAddresses("provinces");
  const districts = useAddresses("districts", province);
  const centers = useAddresses("populated-centers", district);
  const options = (items: NamedReference[]) =>
    items.map((item) => (
      <SelectItem key={item.uuid} value={item.uuid} text={item.display} />
    ));
  return (
    <>
      <Select
        id="infection-province"
        labelText={t("reportProvince")}
        value={province}
        disabled={provinces.loading}
        onChange={(event) => {
          setProvince(event.target.value);
          setDistrict("");
          onChange("");
        }}
      >
        <SelectItem value="" text={t("infectionChooseProvince")} />
        {options(provinces.items)}
      </Select>
      <Select
        id="infection-district"
        labelText={t("reportDistrict")}
        value={district}
        disabled={!province || districts.loading}
        onChange={(event) => {
          setDistrict(event.target.value);
          onChange("");
        }}
      >
        <SelectItem value="" text={t("infectionChooseDistrict")} />
        {options(districts.items)}
      </Select>
      <Select
        id="infection-center"
        labelText={t("reportCenter")}
        value={value ?? ""}
        disabled={!district || centers.loading}
        onChange={(event) => onChange(event.target.value)}
      >
        <SelectItem value="" text={t("infectionChooseCenter")} />
        {options(centers.items)}
        {value && !centers.items.some((item) => item.uuid === value) && (
          <SelectItem value={value} text={t("infectionPreservedCenter")} />
        )}
      </Select>
      {[provinces, districts, centers].some((state) => state.loading) && (
        <InlineLoading description={t("loading")} />
      )}
      {[provinces, districts, centers].map((state, index) =>
        state.error ? (
          <div key={["provinces", "districts", "centers"][index]}>
            <ErrorNotification error={state.error} />
            <Button kind="tertiary" onClick={state.retry}>
              {t("retry")}
            </Button>
          </div>
        ) : null,
      )}
    </>
  );
}
