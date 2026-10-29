import covid19 from "./assets/forms/covid-19.pdf";
import form0 from "./assets/forms/tuberculosis.pdf";
import form1 from "./assets/forms/vih.pdf";
import form2 from "./assets/forms/sifilis-gonorrea.pdf";
import form3 from "./assets/forms/varicela.pdf";
import form4 from "./assets/forms/ofidismo.pdf";
import form5 from "./assets/forms/muerte-materna.pdf";
import form6 from "./assets/forms/muerte-materna-notificacion.pdf";
import form7 from "./assets/forms/diabetes.pdf";
import form8 from "./assets/forms/diabetes-seguimiento.pdf";
import form9 from "./assets/forms/hepatitis-bcd.pdf";
import form10 from "./assets/forms/esavi.pdf";
import form11 from "./assets/forms/esavi-notificacion.pdf";
import form12 from "./assets/forms/violencia-familiar.pdf";
import form13 from "./assets/forms/metales-pesados.pdf";
import form14 from "./assets/forms/sarampion-rubeola.pdf";
import form15 from "./assets/forms/paralisis-flacida.pdf";
import form16 from "./assets/forms/leptospirosis.pdf";
import form17 from "./assets/forms/muerte-fetal-neonatal.pdf";
import form18 from "./assets/forms/vih-gestantes.pdf";
import form19 from "./assets/forms/neumonia-menores.pdf";
import form20 from "./assets/forms/neumonia-mayores.pdf";
import form21 from "./assets/forms/tos-ferina.pdf";
import arbovirosis from "./assets/forms/arbovirosis.pdf";
import leishmaniasis from "./assets/forms/leishmaniasis.pdf";
import malaria from "./assets/forms/malaria.pdf";

import addedForm0 from "./assets/forms/muerte-materna-autopsia-verbal.pdf";
import addedForm1 from "./assets/forms/varicela-sin-complicaciones.pdf";
import addedForm2 from "./assets/forms/rabia-humana.pdf";

export const investigationForms = [
  {
    id: "covid-19",
    url: covid19,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/05/COVID-19_Ficha-de-investigacion-clinico-epidemiologica-COVID-19.pdf",
  },
  {
    id: "muerte-materna-autopsia-verbal",
    url: addedForm0,
    regulation: "NTS N.° 227-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/06/MUERTE-MATERNA_Ficha-de-autopsia-verbal-de-muerte-materna.pdf",
  },
  {
    id: "varicela-sin-complicaciones",
    url: addedForm1,
    regulation: null,
    source:
      "https://risgrau.gob.pe/wp-content/uploads/2024/06/Ficha-clinico-epidemiologico-de-varicela-2017-sin-complicaciones.pdf",
  },
  {
    id: "rabia-humana",
    url: addedForm2,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/06/Ficha-Clinico-Epidemiologica-de-caso-de-rabia-humana.pdf",
  },
  {
    id: "arbovirosis",
    url: arbovirosis,
    regulation: "NTS N.° 230-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/f_arbovirosis.pdf",
  },
  {
    id: "leishmaniasis",
    url: leishmaniasis,
    regulation: "NTS N.° 225-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/05/LEISHMANIASIS-ficha-clinico.pdf",
  },
  {
    id: "malaria",
    url: malaria,
    regulation: "NTS N.° 228-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2026/04/Ficha-de-investigacion-epidemiologica-de-malaria-_16042026-UTEMOTV.pdf",
  },
  {
    id: "tuberculosis",
    url: form0,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/01/Fichas_TB.pdf",
  },
  {
    id: "vih",
    url: form1,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/03/Ficha-notificacion-VIH.pdf",
  },
  {
    id: "sifilis-gonorrea",
    url: form2,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/01/Ficha-investigacion-sifilis_gonorrea.pdf",
  },
  {
    id: "varicela",
    url: form3,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/varicela_cc.pdf",
  },
  {
    id: "ofidismo",
    url: form4,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/fc_Epidemiologica%20de%20caso%20Accidente%20por%20animales%20ponzonosos.pdf",
  },
  {
    id: "muerte-materna",
    url: form5,
    regulation: "NTS N.° 227-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/06/MUERTE-MATERNA_Ficha-de-Investigacion-epidemiologica-de-muerte-materna.pdf",
  },
  {
    id: "muerte-materna-notificacion",
    url: form6,
    regulation: "NTS N.° 227-MINSA/CDC-2025",
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/06/MUERTE-MATERNA_Ficha-de-notificacion-inmediata-de-muerte-materna.pdf",
  },
  {
    id: "diabetes",
    url: form7,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/01/Ficha-de-sobre-vig.-diabetes.pdf",
  },
  {
    id: "diabetes-seguimiento",
    url: form8,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/01/Ficha-de-seguimiento-sobre-vig.-diabetes.pdf",
  },
  {
    id: "hepatitis-bcd",
    url: form9,
    regulation: null,
    source:
      "https://riscuscovraem.pe/wp-content/uploads/2024/01/FICHA-DE-INVESTIGACION-CLINICA-EPIDEMIOLOGICA-HEPATITIS-B.pdf",
  },
  {
    id: "esavi",
    url: form10,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/ESAVI_FI.pdf",
  },
  {
    id: "esavi-notificacion",
    url: form11,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/ESAVI_NI_Anx01.pdf",
  },
  {
    id: "violencia-familiar",
    url: form12,
    regulation: null,
    source: "https://app7.dge.gob.pe/notiWeb/assets/images/Ficha_vfamiliar.pdf",
  },
  {
    id: "metales-pesados",
    url: form13,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/05/Ficha_Metalespesados.pdf",
  },
  {
    id: "sarampion-rubeola",
    url: form14,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/f_srubeola.pdf",
  },
  {
    id: "paralisis-flacida",
    url: form15,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/f_pfa.pdf",
  },
  {
    id: "leptospirosis",
    url: form16,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2026/06/Ficha-Clinico-Epidemiologica-Leptospirosis-Humana.pdf",
  },
  {
    id: "muerte-fetal-neonatal",
    url: form17,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2026/02/MUERTE-FETAL-Y-NEONATAL_Ficha-de-notificacion-de-muerte-neonatal-y-perinatal.pdf",
  },
  {
    id: "vih-gestantes",
    url: form18,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/03/Ficha-investigacion-de-la-gestante-y-el-nino-expuesto-al-VIH.pdf",
  },
  {
    id: "neumonia-menores",
    url: form19,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2024/05/8.7-Ficha-Def-IRA-menor.pdf",
  },
  {
    id: "neumonia-mayores",
    url: form20,
    regulation: null,
    source:
      "https://www.dge.gob.pe/portalnuevo/wp-content/uploads/2025/07/8.8-Ficha-Def-IRA-mayor.pdf",
  },
  {
    id: "tos-ferina",
    url: form21,
    regulation: "NTS N.° 206-MINSA/CDC-2023",
    source:
      "https://www.dge.gob.pe/portal/docs/vigilancia/herramientas/fichas/f_tosf.pdf",
  },
] as const;

export async function fetchInvestigationForm(url: string): Promise<Blob> {
  const response = await fetch(url, {
    credentials: "omit",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Form unavailable");
  const bytes = await response.arrayBuffer();
  // A missing asset can return the SPA HTML with status 200.
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new Error("Invalid form document");
  }
  return new Blob([bytes], { type: "application/pdf" });
}
