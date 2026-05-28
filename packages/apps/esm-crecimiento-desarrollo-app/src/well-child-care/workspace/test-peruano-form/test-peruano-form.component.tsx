// test-peruano-form.tsx
import {
  Button,
  ButtonSet,
  Checkbox,
  Column,
  DatePicker,
  DatePickerInput,
  Form,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextArea,
  Tile,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  getPatientName,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
} from '@openmrs/esm-framework';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import type { ConfigObject } from '../../../config-schema';
import type { DefaultPatientWorkspaceProps } from '../../../types';

import styles from './test-peruano-form.scss';

// Definir tipos para Test Peruano
interface TestPeruanoItem {
  id: string;
  area: 'desarrollo_cognitivo' | 'desarrollo_motor' | 'desarrollo_social_emocional' | 'desarrollo_lenguaje';
  descriptionKey: string;
  descriptionDefault: string;
  ageRange: [number, number]; // [min, max] en meses
  points: number;
  instructionKey?: string;
  instructionDefault?: string;
}

interface TestPeruanoResults {
  desarrollo_cognitivo: {
    score: number;
    total: number;
    percentile: number;
    classification: 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso';
  };
  desarrollo_motor: {
    score: number;
    total: number;
    percentile: number;
    classification: 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso';
  };
  desarrollo_social_emocional: {
    score: number;
    total: number;
    percentile: number;
    classification: 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso';
  };
  desarrollo_lenguaje: {
    score: number;
    total: number;
    percentile: number;
    classification: 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso';
  };
  total: {
    score: number;
    total: number;
    percentile: number;
    classification: 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso';
    recommendationKey: string;
    recommendationDefault: string;
  };
}

// Items del Test Peruano por área y edad (adaptado para el contexto peruano)
const TEST_PERUANO_ITEMS: TestPeruanoItem[] = [
  // DESARROLLO COGNITIVO
  {
    id: 'cog_1',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog1Desc',
    descriptionDefault: 'Reconoce y nombra frutas típicas del Perú (mango, lúcuma, chirimoya)',
    ageRange: [24, 36],
    points: 1,
    instructionKey: 'tpCog1Instr',
    instructionDefault: 'Mostrar imágenes de frutas peruanas',
  },
  {
    id: 'cog_2',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog2Desc',
    descriptionDefault: 'Identifica animales de la sierra peruana (llama, alpaca, cuy)',
    ageRange: [30, 42],
    points: 1,
    instructionKey: 'tpCog2Instr',
    instructionDefault: 'Usar imágenes o juguetes de animales andinos',
  },
  {
    id: 'cog_3',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog3Desc',
    descriptionDefault: 'Clasifica objetos por color usando elementos culturales peruanos',
    ageRange: [36, 48],
    points: 1,
    instructionKey: 'tpCog3Instr',
    instructionDefault: 'Usar textiles andinos de diferentes colores',
  },
  {
    id: 'cog_4',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog4Desc',
    descriptionDefault: 'Cuenta hasta 10 en quechua o español',
    ageRange: [42, 54],
    points: 1,
    instructionKey: 'tpCog4Instr',
    instructionDefault: 'Permitir el uso de cualquiera de los dos idiomas',
  },
  {
    id: 'cog_5',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog5Desc',
    descriptionDefault: 'Reconoce símbolos patrios peruanos (bandera, escudo)',
    ageRange: [48, 60],
    points: 1,
    instructionKey: 'tpCog5Instr',
    instructionDefault: 'Mostrar símbolos patrios simplificados',
  },
  {
    id: 'cog_6',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog6Desc',
    descriptionDefault: 'Resuelve problemas simples usando material concreto andino',
    ageRange: [54, 72],
    points: 1,
    instructionKey: 'tpCog6Instr',
    instructionDefault: 'Usar semillas, piedras u otros materiales naturales',
  },
  {
    id: 'cog_7',
    area: 'desarrollo_cognitivo',
    descriptionKey: 'tpCog7Desc',
    descriptionDefault: 'Comprende conceptos de tiempo relacionados con festividades peruanas',
    ageRange: [60, 84],
    points: 1,
    instructionKey: 'tpCog7Instr',
    instructionDefault: 'Preguntar sobre Inti Raymi, Navidad, etc.',
  },

  // DESARROLLO MOTOR
  {
    id: 'mot_1',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot1Desc',
    descriptionDefault: 'Realiza movimientos de danzas folklóricas peruanas básicas',
    ageRange: [24, 36],
    points: 1,
    instructionKey: 'tpMot1Instr',
    instructionDefault: 'Movimientos simples de marinera o huayno',
  },
  {
    id: 'mot_2',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot2Desc',
    descriptionDefault: 'Manipula instrumentos musicales andinos (maracas, quena de juguete)',
    ageRange: [30, 42],
    points: 1,
    instructionKey: 'tpMot2Instr',
    instructionDefault: 'Instrumentos adaptados para niños',
  },
  {
    id: 'mot_3',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot3Desc',
    descriptionDefault: 'Camina en terreno irregular simulando ambiente andino',
    ageRange: [24, 36],
    points: 1,
    instructionKey: 'tpMot3Instr',
    instructionDefault: 'Usar colchonetas o superficies texturizadas',
  },
  {
    id: 'mot_4',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot4Desc',
    descriptionDefault: 'Realiza actividades de la vida diaria andina (cargar en aguayo)',
    ageRange: [36, 48],
    points: 1,
    instructionKey: 'tpMot4Instr',
    instructionDefault: 'Usar muñecos y telas tradicionales',
  },
  {
    id: 'mot_5',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot5Desc',
    descriptionDefault: 'Coordina movimientos en juegos tradicionales peruanos',
    ageRange: [42, 54],
    points: 1,
    instructionKey: 'tpMot5Instr',
    instructionDefault: 'Juegos como "mata gente" o "mundo"',
  },
  {
    id: 'mot_6',
    area: 'desarrollo_motor',
    descriptionKey: 'tpMot6Desc',
    descriptionDefault: 'Demuestra equilibrio subiendo y bajando escalones',
    ageRange: [48, 60],
    points: 1,
    instructionKey: 'tpMot6Instr',
    instructionDefault: 'Simular escalones de andenes incas',
  },

  // DESARROLLO SOCIAL-EMOCIONAL
  {
    id: 'soc_1',
    area: 'desarrollo_social_emocional',
    descriptionKey: 'tpSoc1Desc',
    descriptionDefault: 'Participa en actividades comunitarias familiares',
    ageRange: [24, 36],
    points: 1,
    instructionKey: 'tpSoc1Instr',
    instructionDefault: 'Preguntar sobre ayni, minga u otras actividades',
  },
  {
    id: 'soc_2',
    area: 'desarrollo_social_emocional',
    descriptionKey: 'tpSoc2Desc',
    descriptionDefault: 'Muestra respeto por los mayores según tradición andina',
    ageRange: [30, 42],
    points: 1,
    instructionKey: 'tpSoc2Instr',
    instructionDefault: 'Observar comportamiento con adultos',
  },
  {
    id: 'soc_3',
    area: 'desarrollo_social_emocional',
    descriptionKey: 'tpSoc3Desc',
    descriptionDefault: 'Demuestra solidaridad y reciprocidad (ayni)',
    ageRange: [36, 48],
    points: 1,
    instructionKey: 'tpSoc3Instr',
    instructionDefault: 'Situaciones de juego cooperativo',
  },
  {
    id: 'soc_4',
    area: 'desarrollo_social_emocional',
    descriptionKey: 'tpSoc4Desc',
    descriptionDefault: 'Expresa emociones de manera culturalmente apropiada',
    ageRange: [42, 54],
    points: 1,
    instructionKey: 'tpSoc4Instr',
    instructionDefault: 'Considerar formas andinas de expresión emocional',
  },
  {
    id: 'soc_5',
    area: 'desarrollo_social_emocional',
    descriptionKey: 'tpSoc5Desc',
    descriptionDefault: 'Comparte alimentos según tradición familiar',
    ageRange: [48, 60],
    points: 1,
    instructionKey: 'tpSoc5Instr',
    instructionDefault: 'Observar comportamiento durante snack time',
  },

  // DESARROLLO DEL LENGUAJE
  {
    id: 'leng_1',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng1Desc',
    descriptionDefault: 'Comprende órdenes simples en español y/o quechua',
    ageRange: [24, 30],
    points: 1,
    instructionKey: 'tpLeng1Instr',
    instructionDefault: 'Usar ambos idiomas según contexto familiar',
  },
  {
    id: 'leng_2',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng2Desc',
    descriptionDefault: 'Nombra alimentos tradicionales peruanos',
    ageRange: [30, 36],
    points: 1,
    instructionKey: 'tpLeng2Instr',
    instructionDefault: 'Papa, quinua, maíz, etc.',
  },
  {
    id: 'leng_3',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng3Desc',
    descriptionDefault: 'Usa palabras en quechua mezcladas con español',
    ageRange: [36, 42],
    points: 1,
    instructionKey: 'tpLeng3Instr',
    instructionDefault: 'Aceptar code-switching natural',
  },
  {
    id: 'leng_4',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng4Desc',
    descriptionDefault: 'Relata actividades familiares tradicionales',
    ageRange: [42, 48],
    points: 1,
    instructionKey: 'tpLeng4Instr',
    instructionDefault: 'Festividades, actividades agrícolas, etc.',
  },
  {
    id: 'leng_5',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng5Desc',
    descriptionDefault: 'Comprende cuentos tradicionales andinos',
    ageRange: [48, 54],
    points: 1,
    instructionKey: 'tpLeng5Instr',
    instructionDefault: 'Usar leyendas adaptadas para la edad',
  },
  {
    id: 'leng_6',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng6Desc',
    descriptionDefault: 'Expresa necesidades en contexto bicultural',
    ageRange: [54, 60],
    points: 1,
    instructionKey: 'tpLeng6Instr',
    instructionDefault: 'Situaciones urbanas y rurales',
  },
  {
    id: 'leng_7',
    area: 'desarrollo_lenguaje',
    descriptionKey: 'tpLeng7Desc',
    descriptionDefault: 'Usa vocabulario específico de la región andina',
    ageRange: [60, 72],
    points: 1,
    instructionKey: 'tpLeng7Instr',
    instructionDefault: 'Términos geográficos, climáticos, culturales',
  },
];

// Esquema de validación
const createTestPeruanoSchema = (t: (key: string, fallback: string) => string) =>
  z.object({
    childAgeMonths: z
      .number()
      .min(24, t('tpMinAge', 'Minimum age is 24 months'))
      .max(84, t('tpMaxAge', 'Maximum age is 84 months')),
    evaluationDate: z.string().min(1, t('tpDateRequired', 'Evaluation date is required')),
    culturalContext: z.enum(['urbano', 'rural', 'urbano_marginal'], {
      required_error: t('tpCulturalContextRequired', 'Cultural context is required'),
    }),
    primaryLanguage: z.enum(['español', 'quechua', 'bilingue'], {
      required_error: t('tpLanguageRequired', 'Primary language is required'),
    }),
    items: z.record(z.boolean()).optional(),
    observations: z.string().optional(),
    culturalNotes: z.string().optional(),
  });

export type TestPeruanoFormType = z.infer<ReturnType<typeof createTestPeruanoSchema>>;

// Componente principal
const TestPeruanoForm: React.FC<DefaultPatientWorkspaceProps> = ({ closeWorkspace, workspaceProps }) => {
  const patientUuid = workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const TestPeruanoSchema = useMemo(() => createTestPeruanoSchema(t), [t]);
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const patient = usePatient(patientUuid);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});

  const { handleSubmit, watch, setValue } = useForm<TestPeruanoFormType>({
    mode: 'all',
    resolver: zodResolver(TestPeruanoSchema),
    defaultValues: {
      childAgeMonths: undefined,
      evaluationDate: new Date().toISOString().split('T')[0],
      culturalContext: 'urbano',
      primaryLanguage: 'español',
      items: {},
      observations: '',
      culturalNotes: '',
    },
  });

  const childAgeMonths = watch('childAgeMonths');
  const culturalContext = watch('culturalContext');
  const primaryLanguage = watch('primaryLanguage');

  // Calcular edad del niño basado en fecha de nacimiento
  useEffect(() => {
    if (patient?.patient?.birthDate) {
      const birthDate = new Date(patient.patient.birthDate);
      const today = new Date();
      const ageInMonths = Math.floor((today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
      setValue('childAgeMonths', ageInMonths);
    }
  }, [patient, setValue]);

  // Filtrar items apropiados para la edad y contexto cultural
  const appropriateItems = useMemo(() => {
    if (!childAgeMonths) return [];
    return TEST_PERUANO_ITEMS.filter((item) => {
      const ageMatch = childAgeMonths >= item.ageRange[0] && childAgeMonths <= item.ageRange[1];

      if (culturalContext === 'rural' && item.id === 'cog_5') {
        return false;
      }

      return ageMatch;
    });
  }, [childAgeMonths, culturalContext]);

  // Calcular percentiles ajustados para población peruana
  const calculatePercentile = useCallback(
    (score: number, total: number, area: string): number => {
      if (total === 0) return 0;

      const percentage = (score / total) * 100;

      let adjustedPercentage = percentage;

      if (primaryLanguage === 'bilingue' && area === 'desarrollo_lenguaje') {
        adjustedPercentage = Math.min(100, percentage * 1.1);
      }

      if (culturalContext === 'rural' && area === 'desarrollo_social_emocional') {
        adjustedPercentage = Math.min(100, percentage * 1.05);
      }

      if (adjustedPercentage >= 95) return 95;
      if (adjustedPercentage >= 85) return 85;
      if (adjustedPercentage >= 75) return 75;
      if (adjustedPercentage >= 50) return 50;
      if (adjustedPercentage >= 25) return 25;
      if (adjustedPercentage >= 15) return 15;
      return 5;
    },
    [primaryLanguage, culturalContext],
  );

  const getClassification = useCallback(
    (percentile: number): 'superior' | 'normal_alto' | 'normal' | 'normal_bajo' | 'limite' | 'retraso' => {
      if (percentile >= 95) return 'superior';
      if (percentile >= 85) return 'normal_alto';
      if (percentile >= 75) return 'normal';
      if (percentile >= 25) return 'normal_bajo';
      if (percentile >= 15) return 'limite';
      return 'retraso';
    },
    [],
  );

  // Calcular resultados con ajustes culturales
  const results: TestPeruanoResults = useMemo(() => {
    const itemsByArea = {
      desarrollo_cognitivo: appropriateItems.filter((item) => item.area === 'desarrollo_cognitivo'),
      desarrollo_motor: appropriateItems.filter((item) => item.area === 'desarrollo_motor'),
      desarrollo_social_emocional: appropriateItems.filter((item) => item.area === 'desarrollo_social_emocional'),
      desarrollo_lenguaje: appropriateItems.filter((item) => item.area === 'desarrollo_lenguaje'),
    };

    const calculateAreaResult = (items: TestPeruanoItem[], areaName: string) => {
      const total = items.length;
      const score = items.reduce((sum, item) => sum + (selectedItems[item.id] ? item.points : 0), 0);
      const percentile = calculatePercentile(score, total, areaName);
      const classification = getClassification(percentile);

      return { score, total, percentile, classification };
    };

    const desarrollo_cognitivo = calculateAreaResult(itemsByArea.desarrollo_cognitivo, 'desarrollo_cognitivo');
    const desarrollo_motor = calculateAreaResult(itemsByArea.desarrollo_motor, 'desarrollo_motor');
    const desarrollo_social_emocional = calculateAreaResult(
      itemsByArea.desarrollo_social_emocional,
      'desarrollo_social_emocional',
    );
    const desarrollo_lenguaje = calculateAreaResult(itemsByArea.desarrollo_lenguaje, 'desarrollo_lenguaje');

    const totalScore =
      desarrollo_cognitivo.score +
      desarrollo_motor.score +
      desarrollo_social_emocional.score +
      desarrollo_lenguaje.score;
    const totalPossible =
      desarrollo_cognitivo.total +
      desarrollo_motor.total +
      desarrollo_social_emocional.total +
      desarrollo_lenguaje.total;
    const totalPercentile = calculatePercentile(totalScore, totalPossible, 'total');
    const totalClassification = getClassification(totalPercentile);

    let recommendationKey = 'tpRecommendationNormal';
    let recommendationDefault =
      'Development is appropriate for age and cultural context. Continue with regular activities.';
    if (totalClassification === 'retraso' || totalClassification === 'limite') {
      recommendationKey = 'tpRecommendationDelay';
      recommendationDefault = 'Specialist evaluation and culturally appropriate early stimulation are recommended.';
    } else if (totalClassification === 'normal_bajo') {
      recommendationKey = 'tpRecommendationLowNormal';
      recommendationDefault = 'Stimulation activities using familiar cultural elements are suggested.';
    }

    return {
      desarrollo_cognitivo,
      desarrollo_motor,
      desarrollo_social_emocional,
      desarrollo_lenguaje,
      total: {
        score: totalScore,
        total: totalPossible,
        percentile: totalPercentile,
        classification: totalClassification,
        recommendationKey,
        recommendationDefault,
      },
    };
  }, [appropriateItems, selectedItems, calculatePercentile, getClassification]);

  const handleItemChange = (itemId: string, checked: boolean) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: checked,
    }));
  };

  const saveTestPeruanoData = useCallback(
    async (data: TestPeruanoFormType) => {
      setIsSubmitting(true);
      setShowErrorNotification(false);

      const locationUuid = session?.sessionLocation?.uuid;
      if (!locationUuid) {
        showSnackbar({
          title: t('testPeruanoSaveError', 'Error saving Test Peruano'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t('noSessionLocation', 'Could not determine session location. Please log in again.'),
        });
        setIsSubmitting(false);
        return;
      }

      const obs: Array<{ concept: string; value: string | number }> = [];
      const tp = config.testPeruano;

      if (tp.scoreCognitivoUuid) {
        obs.push({ concept: tp.scoreCognitivoUuid, value: results.desarrollo_cognitivo.score });
      }
      if (tp.scoreMotorUuid) {
        obs.push({ concept: tp.scoreMotorUuid, value: results.desarrollo_motor.score });
      }
      if (tp.scoreSocialUuid) {
        obs.push({ concept: tp.scoreSocialUuid, value: results.desarrollo_social_emocional.score });
      }
      if (tp.scoreLenguajeUuid) {
        obs.push({ concept: tp.scoreLenguajeUuid, value: results.desarrollo_lenguaje.score });
      }
      if (tp.clasificacionTotalUuid) {
        obs.push({ concept: tp.clasificacionTotalUuid, value: results.total.classification });
      }
      if (tp.contextoCulturalUuid) {
        obs.push({ concept: tp.contextoCulturalUuid, value: data.culturalContext });
      }
      if (tp.idiomaUuid) {
        obs.push({ concept: tp.idiomaUuid, value: data.primaryLanguage });
      }
      if (tp.observacionesUuid && data.observations) {
        obs.push({ concept: tp.observacionesUuid, value: data.observations });
      }

      if (obs.length === 0) {
        showSnackbar({
          title: t('testPeruanoSaveError', 'Error saving Test Peruano'),
          kind: 'error',
          isLowContrast: false,
          subtitle: t(
            'testPeruanoMissingConcepts',
            'No hay conceptos configurados para guardar el Test Peruano. Revise la configuración del módulo.',
          ),
        });
        setIsSubmitting(false);
        return;
      }

      const abortController = new AbortController();

      try {
        const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortController.signal,
          body: {
            patient: patientUuid,
            location: locationUuid,
            encounterType: tp.encounterTypeUuid,
            obs,
          },
        });

        if (response.status === 201 || response.status === 200) {
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            title: t('testPeruanoSaved', 'Test Peruano saved'),
            subtitle: t('testPeruanoDataAvailable', 'The evaluation is now available in the patient record'),
          });
          closeWorkspace({ discardUnsavedChanges: true });
        }
      } catch (error) {
        setShowErrorNotification(true);
        showSnackbar({
          title: t('testPeruanoSaveError', 'Error saving Test Peruano'),
          kind: 'error',
          isLowContrast: false,
          subtitle:
            (error as Error)?.message ?? t('unexpectedError', 'An unexpected error occurred. Please try again.'),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [config.testPeruano, closeWorkspace, patientUuid, results, session?.sessionLocation?.uuid, t],
  );

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'superior':
        return 'purple';
      case 'normal_alto':
        return 'blue';
      case 'normal':
        return 'green';
      case 'normal_bajo':
        return 'warm-gray';
      case 'limite':
        return 'magenta';
      case 'retraso':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getClassificationText = (classification: string) => {
    switch (classification) {
      case 'superior':
        return t('superior', 'Superior');
      case 'normal_alto':
        return t('normalAlto', 'Normal Alto');
      case 'normal':
        return t('normal', 'Normal');
      case 'normal_bajo':
        return t('normalBajo', 'Normal Bajo');
      case 'limite':
        return t('limite', 'Límite');
      case 'retraso':
        return t('retraso', 'Retraso');
      default:
        return '';
    }
  };

  return (
    <Form className={styles.form} onSubmit={handleSubmit(saveTestPeruanoData)}>
      <Stack gap={6}>
        <Column>
          <h3 className={styles.title}>{t('testPeruanoTitle', 'Peruvian Child Development Test')}</h3>
          <p className={styles.subtitle}>
            {t('testPeruanoSubtitle', 'Child development assessment adapted to the Peruvian cultural context')}
          </p>
        </Column>

        {/* Información del paciente y contexto cultural */}
        <Column>
          <Tile className={styles.patientInfo}>
            <Stack gap={4}>
              <h4>{t('patientAndCulturalInfo', 'Patient Information and Cultural Context')}</h4>
              <div className={styles.infoGrid}>
                <div>
                  <p>
                    <strong>{t('name', 'Name')}:</strong>{' '}
                    {patient.patient ? getPatientName(patient.patient) : t('loading', 'Loading...')}
                  </p>
                  <p>
                    <strong>{t('age', 'Age')}:</strong> {t('ageMonths', '{{count}} meses', { count: childAgeMonths })}
                  </p>
                </div>
                <div>
                  <Select
                    id="cultural-context"
                    labelText={t('culturalContext', 'Contexto Cultural')}
                    value={culturalContext}
                    onChange={(e) =>
                      setValue('culturalContext', e.target.value as 'urbano' | 'rural' | 'urbano_marginal')
                    }
                  >
                    <SelectItem value="urbano" text={t('urban', 'Urbano')} />
                    <SelectItem value="rural" text={t('rural', 'Rural/Andino')} />
                    <SelectItem value="urbano_marginal" text={t('urbanMarginal', 'Urbano Marginal')} />
                  </Select>
                </div>
                <div>
                  <Select
                    id="primary-language"
                    labelText={t('primaryLanguage', 'Idioma Primario')}
                    value={primaryLanguage}
                    onChange={(e) => setValue('primaryLanguage', e.target.value as 'español' | 'quechua' | 'bilingue')}
                  >
                    <SelectItem value="español" text={t('spanish', 'Español')} />
                    <SelectItem value="quechua" text={t('quechua', 'Quechua')} />
                    <SelectItem value="bilingue" text={t('bilingual', 'Bilingüe (Español/Quechua)')} />
                  </Select>
                </div>
              </div>
              <DatePicker
                datePickerType="single"
                dateFormat="Y-m-d"
                onChange={(dates) => {
                  if (dates[0]) {
                    setValue('evaluationDate', dates[0].toISOString().split('T')[0]);
                  }
                }}
              >
                <DatePickerInput
                  placeholder="yyyy-mm-dd"
                  labelText={t('evaluationDate', 'Evaluation date')}
                  id="evaluation-date"
                />
              </DatePicker>
            </Stack>
          </Tile>
        </Column>

        {/* Resultados en tiempo real */}
        {childAgeMonths && (
          <Column>
            <Tile className={styles.results}>
              <Stack gap={4}>
                <h4>{t('resultsPreview', 'Results preview — real time')}</h4>

                <div className={styles.resultGrid}>
                  <div className={styles.resultCard}>
                    <h5>{t('desarrolloCognitivo', 'Desarrollo Cognitivo')}</h5>
                    <p>
                      {results.desarrollo_cognitivo.score}/{results.desarrollo_cognitivo.total}
                    </p>
                    <p className={styles.percentile}>
                      {t('percentileLabel', 'Percentil')}: {results.desarrollo_cognitivo.percentile}
                    </p>
                    <Tag type={getClassificationColor(results.desarrollo_cognitivo.classification)}>
                      {getClassificationText(results.desarrollo_cognitivo.classification)}
                    </Tag>
                  </div>

                  <div className={styles.resultCard}>
                    <h5>{t('desarrolloMotor', 'Desarrollo Motor')}</h5>
                    <p>
                      {results.desarrollo_motor.score}/{results.desarrollo_motor.total}
                    </p>
                    <p className={styles.percentile}>
                      {t('percentileLabel', 'Percentil')}: {results.desarrollo_motor.percentile}
                    </p>
                    <Tag type={getClassificationColor(results.desarrollo_motor.classification)}>
                      {getClassificationText(results.desarrollo_motor.classification)}
                    </Tag>
                  </div>

                  <div className={styles.resultCard}>
                    <h5>{t('desarrolloSocialEmocional', 'Desarrollo Social-Emocional')}</h5>
                    <p>
                      {results.desarrollo_social_emocional.score}/{results.desarrollo_social_emocional.total}
                    </p>
                    <p className={styles.percentile}>
                      {t('percentileLabel', 'Percentil')}: {results.desarrollo_social_emocional.percentile}
                    </p>
                    <Tag type={getClassificationColor(results.desarrollo_social_emocional.classification)}>
                      {getClassificationText(results.desarrollo_social_emocional.classification)}
                    </Tag>
                  </div>

                  <div className={styles.resultCard}>
                    <h5>{t('desarrolloLenguaje', 'Desarrollo del Lenguaje')}</h5>
                    <p>
                      {results.desarrollo_lenguaje.score}/{results.desarrollo_lenguaje.total}
                    </p>
                    <p className={styles.percentile}>
                      {t('percentileLabel', 'Percentil')}: {results.desarrollo_lenguaje.percentile}
                    </p>
                    <Tag type={getClassificationColor(results.desarrollo_lenguaje.classification)}>
                      {getClassificationText(results.desarrollo_lenguaje.classification)}
                    </Tag>
                  </div>

                  <div className={`${styles.resultCard} ${styles.totalCard}`}>
                    <h5>{t('total', 'Total')}</h5>
                    <p>
                      {results.total.score}/{results.total.total}
                    </p>
                    <p className={styles.percentile}>
                      {t('percentileLabel', 'Percentil')}: {results.total.percentile}
                    </p>
                    <Tag type={getClassificationColor(results.total.classification)}>
                      {getClassificationText(results.total.classification)}
                    </Tag>
                  </div>
                </div>

                {results.total.recommendationKey && (
                  <div className={styles.recommendation}>
                    <h5>{t('recommendation', 'Recomendación')}</h5>
                    <p>{t(results.total.recommendationKey, results.total.recommendationDefault)}</p>
                  </div>
                )}
              </Stack>
            </Tile>
          </Column>
        )}

        {/* Items de evaluación */}
        {appropriateItems.length > 0 && (
          <Column>
            <Stack gap={4}>
              <h4>
                {t('evaluationItems', 'Evaluation items')} ({appropriateItems.length})
              </h4>

              {/* Desarrollo Cognitivo */}
              <div className={styles.areaSection}>
                <h5 className={styles.areaTitle}>{t('desarrolloCognitivo', 'Desarrollo Cognitivo')}</h5>
                <div className={styles.itemsGrid}>
                  {appropriateItems
                    .filter((item) => item.area === 'desarrollo_cognitivo')
                    .map((item) => (
                      <div key={item.id} className={styles.itemContainer}>
                        <Checkbox
                          labelText={t(item.descriptionKey, item.descriptionDefault)}
                          id={item.id}
                          checked={selectedItems[item.id] || false}
                          onChange={(_, { checked }) => handleItemChange(item.id, checked)}
                          className={styles.itemCheckbox}
                        />
                        {item.instructionKey && (
                          <p className={styles.instruction}>{t(item.instructionKey, item.instructionDefault)}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Desarrollo Motor */}
              <div className={styles.areaSection}>
                <h5 className={styles.areaTitle}>{t('desarrolloMotor', 'Desarrollo Motor')}</h5>
                <div className={styles.itemsGrid}>
                  {appropriateItems
                    .filter((item) => item.area === 'desarrollo_motor')
                    .map((item) => (
                      <div key={item.id} className={styles.itemContainer}>
                        <Checkbox
                          labelText={t(item.descriptionKey, item.descriptionDefault)}
                          id={item.id}
                          checked={selectedItems[item.id] || false}
                          onChange={(_, { checked }) => handleItemChange(item.id, checked)}
                          className={styles.itemCheckbox}
                        />
                        {item.instructionKey && (
                          <p className={styles.instruction}>{t(item.instructionKey, item.instructionDefault)}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Desarrollo Social-Emocional */}
              <div className={styles.areaSection}>
                <h5 className={styles.areaTitle}>{t('desarrolloSocialEmocional', 'Desarrollo Social-Emocional')}</h5>
                <div className={styles.itemsGrid}>
                  {appropriateItems
                    .filter((item) => item.area === 'desarrollo_social_emocional')
                    .map((item) => (
                      <div key={item.id} className={styles.itemContainer}>
                        <Checkbox
                          labelText={t(item.descriptionKey, item.descriptionDefault)}
                          id={item.id}
                          checked={selectedItems[item.id] || false}
                          onChange={(_, { checked }) => handleItemChange(item.id, checked)}
                          className={styles.itemCheckbox}
                        />
                        {item.instructionKey && (
                          <p className={styles.instruction}>{t(item.instructionKey, item.instructionDefault)}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Desarrollo del Lenguaje */}
              <div className={styles.areaSection}>
                <h5 className={styles.areaTitle}>{t('desarrolloLenguaje', 'Desarrollo del Lenguaje')}</h5>
                <div className={styles.itemsGrid}>
                  {appropriateItems
                    .filter((item) => item.area === 'desarrollo_lenguaje')
                    .map((item) => (
                      <div key={item.id} className={styles.itemContainer}>
                        <Checkbox
                          labelText={t(item.descriptionKey, item.descriptionDefault)}
                          id={item.id}
                          checked={selectedItems[item.id] || false}
                          onChange={(_, { checked }) => handleItemChange(item.id, checked)}
                          className={styles.itemCheckbox}
                        />
                        {item.instructionKey && (
                          <p className={styles.instruction}>{t(item.instructionKey, item.instructionDefault)}</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </Stack>
          </Column>
        )}

        {/* Observaciones culturales */}
        <Column>
          <TextArea
            labelText={t('culturalNotes', 'Cultural and contextual notes')}
            placeholder={t(
              'culturalNotesPlaceholder',
              'Notes on cultural, family, or environmental factors that may influence development...',
            )}
            value={watch('culturalNotes')}
            onChange={(e) => setValue('culturalNotes', e.target.value)}
            rows={3}
          />
        </Column>

        {/* Observaciones generales */}
        <Column>
          <TextArea
            labelText={t('generalObservations', 'General observations')}
            placeholder={t('observationsPlaceholder', 'Additional observations about the evaluation...')}
            value={watch('observations')}
            onChange={(e) => setValue('observations', e.target.value)}
            rows={3}
          />
        </Column>

        {showErrorNotification && (
          <Column>
            <InlineNotification
              kind="error"
              title={t('error', 'Error')}
              subtitle={t('testPeruanoSaveErrorRetry', 'Please check the form and try again.')}
              onClose={() => setShowErrorNotification(false)}
            />
          </Column>
        )}

        <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
          <Button kind="secondary" onClick={() => closeWorkspace()} disabled={isSubmitting}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button kind="primary" type="submit" disabled={isSubmitting || !childAgeMonths}>
            {isSubmitting ? t('saving', 'Saving...') : t('saveAndClose', 'Save and close')}
          </Button>
        </ButtonSet>
      </Stack>
    </Form>
  );
};

export default TestPeruanoForm;
