import { Select, SelectItem } from "@carbon/react";
import { useEffect, useState } from "react";
import { addressChildren } from "./api";
import type { NamedReference } from "./types";

export function InfectionAddressSelector({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const [provinces, setProvinces] = useState<NamedReference[]>([]);
  const [districts, setDistricts] = useState<NamedReference[]>([]);
  const [centers, setCenters] = useState<NamedReference[]>([]);
  const [province, setProvince] = useState(""); const [district, setDistrict] = useState("");
  useEffect(() => { void addressChildren("provinces").then(setProvinces).catch(() => setProvinces([])); }, []);
  useEffect(() => { setDistricts([]); setCenters([]); setDistrict(""); onChange(""); if (province) void addressChildren("districts", province).then(setDistricts).catch(() => setDistricts([])); }, [province]);
  useEffect(() => { setCenters([]); onChange(""); if (district) void addressChildren("populated-centers", district).then(setCenters).catch(() => setCenters([])); }, [district]);
  const options = (items: NamedReference[]) => items.map((item) => <SelectItem key={item.uuid} value={item.uuid} text={item.display} />);
  return <><Select id="infection-province" labelText="Provincia" value={province} onChange={(e) => setProvince(e.target.value)}><SelectItem value="" text="Seleccione una provincia" />{options(provinces)}</Select><Select id="infection-district" labelText="Distrito" value={district} disabled={!province} onChange={(e) => setDistrict(e.target.value)}><SelectItem value="" text="Seleccione un distrito" />{options(districts)}</Select><Select id="infection-center" labelText="Centro poblado" value={value ?? ""} disabled={!district} onChange={(e) => onChange(e.target.value)}><SelectItem value="" text="Seleccione un centro poblado" />{options(centers)}</Select></>;
}
