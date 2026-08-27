import { Type, validators } from '@openmrs/esm-framework';

export const configSchema = {
  leftNavMode: {
    _type: Type.String,
    _default: 'normal',
    _description:
      'Allows making the left nav bar always collapsed (even on large screens) or completely hidden on the home page.',
    _validators: [validators.oneOf(['normal', 'collapsed', 'hidden'])],
  },
  defaultDashboardPerRole: {
    _type: Type.Object,
    _default: {
      'Organizational: Registration Clerk': 'home',
    },
    _description:
      'Keys are user roles, values are names of dashboards (what goes in the URL after /home/). If a role\'s default dashboard is not configured here, "home" is the default.',
    _elements: {
      _type: Type.String,
    },
  },
  clinicalReferenceLinks: {
    _type: Type.Array,
    _description:
      'Third-party reference sites offered on the home page. These are not part of SIH Salus: they open in a new tab and the whole section is hidden while the browser is offline. Set to an empty array to remove it.',
    _elements: {
      label: {
        _type: Type.String,
        _description: 'Name of the site, shown as the link text.',
      },
      description: {
        _type: Type.String,
        _description: 'One short line telling the clinician what the site is for.',
      },
      url: {
        _type: Type.String,
        _description: 'Absolute https:// address. Relative paths would resolve inside SIH Salus.',
      },
    },
    _default: [
      {
        label: 'DIGEMID — Observatorio de precios',
        description: 'Precios de medicamentos en farmacias del país',
        url: 'https://opm.digemid.minsa.gob.pe/',
      },
      {
        label: 'DIGEMID',
        description: 'Petitorio nacional y registro sanitario de medicamentos',
        url: 'https://www.digemid.minsa.gob.pe/',
      },
      {
        label: 'Normas técnicas MINSA',
        description: 'Documentos normativos de salud vigentes',
        url: 'https://www.gob.pe/institucion/minsa/colecciones/1489-documentos-normativos-de-salud',
      },
      {
        label: 'Seguro Integral de Salud',
        description: 'Trámites y cobertura del SIS',
        url: 'https://www.gob.pe/sis',
      },
      {
        label: 'MDCalc',
        description: 'Calculadoras y scores clínicos',
        url: 'https://www.mdcalc.com/',
      },
      {
        label: 'Calculadora de TFG',
        description: 'Tasa de filtración glomerular (CKD-EPI)',
        url: 'https://www.kidney.org/professionals/gfr_calculator',
      },
      {
        label: 'CIE-10 (OMS)',
        description: 'Clasificación internacional de enfermedades, 10.ª revisión',
        url: 'https://icd.who.int/browse10/2019/en',
      },
      {
        label: 'CIE-11 en español',
        description: 'Clasificación internacional de enfermedades, 11.ª revisión',
        url: 'https://icd.who.int/browse/2024-01/mms/es',
      },
      {
        label: 'Patrones de crecimiento OMS',
        description: 'Tablas y estándares de crecimiento infantil',
        url: 'https://www.who.int/tools/child-growth-standards/standards',
      },
      {
        label: 'OPS/OMS',
        description: 'Guías y temas de salud de la Organización Panamericana',
        url: 'https://www.paho.org/es/temas',
      },
    ],
  },
};

export interface ReferenceLink {
  label: string;
  description?: string;
  url: string;
}

export interface HomeConfig {
  leftNavMode: 'normal' | 'collapsed' | 'hidden';
  defaultDashboardPerRole: Record<string, string>;
  clinicalReferenceLinks: Array<ReferenceLink>;
}
