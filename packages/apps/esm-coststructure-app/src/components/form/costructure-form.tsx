import { Button, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { WhitePaper } from '@carbon/react/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { baseUrl } from '../../constants';
import { type Procedure } from '../../hooks/use-get-procedures';
import { calculateDepreciationByMinutes, calculateTotalValidConsruction } from '../../utils/infrastructure';
import PageHeader from '../ui/PageHeader/pageHeader';
import { ProcedureAutocomplete } from './autocomplete/procedure-autocomplete';
import styles from './form.scss';
import { type CostStructureFormValues, costStructureSchema } from './schema/costructure-schema';
import EquipmentTab from './tabs/equipment-tab';
import GeneralServiceTab from './tabs/general-service-tab';
import HumanResourceTab from './tabs/humanresource-tab';
import InfrastructureTab from './tabs/infrastructure-tab';
import PublicServicesTab from './tabs/public-service-tab';
import SummaryTab from './tabs/summary-tab';
import SupplyTab from './tabs/supply-tab';

function toCostStructureDto(data: CostStructureFormValues) {
  return {
    procedure: data.procedure,
    anualServiceCost: {
      energyAnnualCost: data.annualServicesCost.annualEnergyCost,
      waterAnnualCost: data.annualServicesCost.annualWaterCost,
      phonenetAnnualCost: data.annualServicesCost.annualPhoneNetCost,
      generalAdminAnnualCost: data.annualServicesCost.annualAdministrativeCost,
      generalServiceAnnualCost: data.annualServicesCost.annualGeneralCost,
    },
    humanResourceCosts: data.humanResourceCost.map(({ quantity, timeMinutes, costMinutes, priceMonth }) => ({
      quantity,
      timeMinutes,
      costMinutes,
      priceMonth,
    })),
    equipmentCosts: data.equipmentCost.map(({ quantity, timeMinutes }) => ({
      quantity,
      timeMinutes,
    })),
    infrastructureCosts: data.infrastructures.map((infrastructure, index) => {
      const totalConstruction = calculateTotalValidConsruction(infrastructure.areaM2, infrastructure.constructionCost);

      return {
        annualUnitDep: calculateDepreciationByMinutes(totalConstruction),
        performanceTimeService: infrastructure.timePerformanceMinutes,
        productionProyected: data.publicServices[index]?.productionProyected ?? 0,
      };
    }),
  };
}

export default function CostStructureForm() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useTranslation();

  const form = useForm<CostStructureFormValues>({
    resolver: zodResolver(costStructureSchema as never),
    defaultValues: {
      procedure: { conceptId: 0, nameFull: '', code: '' },
      infrastructures: [],
      publicServices: [],
      supplyCost: [],
      equipmentCost: [],
      humanResourceCost: [],
      annualServicesCost: {
        annualAdministrativeCost: 0,
        annualEnergyCost: 0,
        annualGeneralCost: 0,
        annualPhoneNetCost: 0,
        annualWaterCost: 0,
      },
    },
  });
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = form;

  const onSubmit = async (data: CostStructureFormValues) => {
    setIsSubmitting(true);
    try {
      await openmrsFetch(`${baseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toCostStructureDto(data)),
      });
      showSnackbar({
        kind: 'success',
        isLowContrast: true,
        title: t('costStructureSaved', 'Cost structure saved'),
        subtitle: t('costStructureSavedSubtitle', 'The cost structure was saved successfully'),
      });
      reset();
    } catch (error) {
      showSnackbar({
        kind: 'error',
        isLowContrast: false,
        title: t('errorSavingCostStructure', 'Error saving cost structure'),
        subtitle: error?.message ?? t('unknownError', 'Unknown error'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onError = () => {
    showSnackbar({
      kind: 'warning',
      isLowContrast: true,
      title: t('validationErrors', 'Validation errors'),
      subtitle: t('fixValidationErrors', 'Please fix the highlighted fields before saving'),
    });
  };

  const handleTanbChange = (state: { selectedIndex: number }) => {
    setSelectedTab((_index) => state.selectedIndex);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onError)} className="">
      <PageHeader
        icon={<WhitePaper size={48} />}
        title={t('createCostStructureCpms', 'Create Cost Structure – CPMS')}
        subtitle={t('costing', 'Costing')}
      />
      <div className="">
        <section className={styles['header-form']}>
          <h3 className={styles.title}>{t('procedureInfo', 'Procedure Information')}</h3>

          <Controller
            name="procedure"
            control={control}
            render={({ field }) => (
              <ProcedureAutocomplete
                value={field.value as Procedure}
                onChange={(proc) => setValue('procedure', proc)}
                error={errors.procedure?.nameFull?.message}
              />
            )}
          />
        </section>

        {/* Tabs de costos */}
        <section className={styles['body-form']}>
          <h3 className={styles.title}>{t('detailedCostStructure', 'Detailed Cost Structure')}</h3>
          <Tabs selectedIndex={selectedTab} onChange={handleTanbChange}>
            <TabList>
              <Tab>{t('suppliesAndMedicines', 'Supplies and Medicines')}</Tab>
              <Tab>{t('equipmentAndFurniture', 'Equipment and Furniture')}</Tab>
              <Tab>{t('humanResources', 'Human Resources')}</Tab>
              <Tab>{t('infrastructure', 'Infrastructure')}</Tab>
              <Tab>{t('publicServices', 'Public Services')}</Tab>
              <Tab>{t('generalServices', 'General Services')}</Tab>
              <Tab>{t('summary', 'Summary')}</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <SupplyTab form={form} />
              </TabPanel>
              <TabPanel>
                <EquipmentTab form={form} />
              </TabPanel>
              <TabPanel>
                <HumanResourceTab form={form} />
              </TabPanel>
              <TabPanel>
                <InfrastructureTab form={form} />
              </TabPanel>
              <TabPanel>
                <PublicServicesTab form={form} />
              </TabPanel>
              <TabPanel>
                <GeneralServiceTab form={form} />
              </TabPanel>
              <TabPanel>
                <SummaryTab form={form} />
              </TabPanel>
            </TabPanels>
          </Tabs>
        </section>

        <div className="flex gap-2">
          <Button kind="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving', 'Saving...') : t('saveStructure', 'Save structure')}
          </Button>
          <Button kind="secondary" type="reset">
            {t('clear', 'Clear')}
          </Button>
        </div>
      </div>
    </form>
  );
}
