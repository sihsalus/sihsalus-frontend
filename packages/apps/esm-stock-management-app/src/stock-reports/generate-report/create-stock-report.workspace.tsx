import {
  Button,
  ButtonSet,
  Checkbox,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Form,
  FormGroup,
  InlineLoading,
  NumberInput,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  Stack,
} from '@carbon/react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ConfigObject,
  type DefaultWorkspaceProps,
  getCoreTranslation,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DATE_PICKER_CONTROL_FORMAT, DATE_PICKER_FORMAT, formatForDatePicker, today } from '../../constants';
import { BatchJobTypeReport } from '../../core/api/types/BatchJob';
import { type Concept } from '../../core/api/types/concept/Concept';
import { formatDisplayDate } from '../../core/utils/datetimeUtils';
import { createBatchJob } from '../../stock-batch/stock-batch.resource';
import { useConcept, useStockTagLocations } from '../../stock-lookups/stock-lookups.resource';
import { handleMutate } from '../../utils';
import {
  getParamDefaultLimit,
  getReportEndDateLabel,
  getReportLimitLabel,
  getReportStartDateLabel,
  ReportParameter,
} from '../ReportType';
import { reportSchema, type StockReportSchema } from '../report-validation-schema';
import { useReportTypes } from '../stock-reports.resource';
import styles from './create-stock-report.scss';

type CreateReportProps = DefaultWorkspaceProps & {
  model?: ReportModel;
};

export interface ReportModel {
  reportSystemName?: string;
  reportName?: string;
  parameters?: string[];
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  stockItemCategory?: string;
  stockItemCategoryConceptUuid?: string;
  location?: string;
  locationUuid?: string;
  childLocations: boolean;
  stockSourceUuid?: string;
  stockSource?: string;
  stockSourceDestinationUuid?: string;
  stockSourceDestination?: string;
  inventoryGroupBy?: string;
  inventoryGroupByName?: string;
  maxReorderLevelRatio?: number;
  stockItemUuid?: string;
  stockItemName?: string;
  patientUuid?: string;
  patientName?: string;
  limit?: number | null;
  mostLeastMoving?: string;
  mostLeastMovingName?: string;
  fulfillment?: string[];
  /** @deprecated Use `fulfillment` instead. */
  fullFillment?: string[];
}

function getReportParameter(
  name: string,
  value: string,
  valueDescription: string,
  description: string,
  newLine: string,
): string {
  return `param.${name}.value=${value}${newLine}param.${name}.value.desc=${valueDescription}${newLine}param.${name}.description=${description}${newLine}`;
}

const CreateReport: React.FC<CreateReportProps> = ({ model, closeWorkspace }) => {
  const { t } = useTranslation();
  const { stockItemCategoryUUID } = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';

  const { reportTypes, isLoading } = useReportTypes();
  const { stockLocations } = useStockTagLocations();
  const { items } = useConcept(stockItemCategoryUUID);
  const [displayDate, setDisplayDate] = useState<boolean>(false);
  const [displayStartDate, setDisplayStartDate] = useState<boolean>(false);
  const [displayEndDate, setDisplayEndDate] = useState<boolean>(false);
  const [displayStockItemCategory, setDisplayStockItemCategory] = useState<boolean>(false);
  const [displayLocation, setDisplayLocation] = useState<boolean>(false);
  const [displayChildLocations, setDisplayChildLocations] = useState<boolean>(false);
  const [displayStockSource, setDisplayStockSource] = useState<boolean>(false);
  const [displayStockSourceDestination, setDisplayStockSourceDestination] = useState<boolean>(false);
  const [displayInventoryGroupBy, setDisplayInventoryGroupBy] = useState<boolean>(false);
  const [displayMaxReorderLevelRatio, setDisplayMaxReorderLevelRatio] = useState<boolean>(false);
  const [displayPatient, setDisplayPatient] = useState<boolean>(false);
  const [displayStockItem, setDisplayStockItem] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<boolean>(false);
  const [displayMostLeastMoving, setDisplayMostLeastMoving] = useState<boolean>(false);
  const [displayFulfillment, setDisplayFulfillment] = useState<boolean>(false);
  const [selectedReportName, setSelectedReportName] = useState<string>('');

  const handleReportNameChange = (name: string) => {
    setSelectedReportName(name);
  };

  useEffect(() => {
    let hasResetParameters = false;
    if (selectedReportName) {
      const reportType = Array.isArray(reportTypes)
        ? reportTypes.find((p) => p.name === selectedReportName)
        : undefined;
      if (reportType) {
        setDisplayDate(reportType.parameters?.some((p) => p === ReportParameter.Date));
        setDisplayStartDate(reportType.parameters?.some((p) => p === ReportParameter.StartDate));
        setDisplayEndDate(reportType.parameters?.some((p) => p === ReportParameter.EndDate));
        setDisplayStockItemCategory(reportType.parameters?.some((p) => p === ReportParameter.StockItemCategory));
        setDisplayLocation(reportType.parameters?.some((p) => p === ReportParameter.Location));
        setDisplayChildLocations(reportType.parameters?.some((p) => p === ReportParameter.ChildLocations));
        setDisplayStockSource(reportType.parameters?.some((p) => p === ReportParameter.StockSource));
        setDisplayStockSourceDestination(
          reportType.parameters?.some((p) => p === ReportParameter.StockSourceDestination),
        );
        setDisplayInventoryGroupBy(reportType.parameters?.some((p) => p === ReportParameter.InventoryGroupBy));
        setDisplayMaxReorderLevelRatio(reportType.parameters?.some((p) => p === ReportParameter.MaxReorderLevelRatio));
        setDisplayStockItem(reportType.parameters?.some((p) => p === ReportParameter.StockItem));
        setDisplayPatient(reportType.parameters?.some((p) => p === ReportParameter.Patient));
        setDisplayLimit(reportType.parameters?.some((p) => p === ReportParameter.Limit));
        setDisplayMostLeastMoving(reportType.parameters?.some((p) => p === ReportParameter.MostLeastMoving));
        setDisplayFulfillment(reportType.parameters?.some((p) => p === ReportParameter.Fullfillment));
        hasResetParameters = true;
      }
    }
    if (!hasResetParameters) {
      setDisplayDate(false);
      setDisplayStartDate(false);
      setDisplayEndDate(false);
      setDisplayStockItemCategory(false);
      setDisplayLocation(false);
      setDisplayChildLocations(false);
      setDisplayStockSource(false);
      setDisplayStockSourceDestination(false);
      setDisplayInventoryGroupBy(false);
      setDisplayMaxReorderLevelRatio(false);
      setDisplayStockItem(false);
      setDisplayPatient(false);
      setDisplayLimit(false);
      setDisplayMostLeastMoving(false);
      setDisplayFulfillment(false);
    }
  }, [selectedReportName, reportTypes]);

  const stockItemCategories = useMemo(() => {
    return [
      {
        display: t('allCategories', 'All categories'),
        name: t('allCategories', 'All categories'),
        uuid: '',
      } as unknown as Concept,
      ...((items && items?.answers?.length > 0 ? items?.answers : items?.setMembers) ?? []),
    ];
  }, [items, t]);
  const {
    handleSubmit,
    control,
    formState: { errors },
    setValue,
  } = useForm<StockReportSchema>({
    mode: 'all',
    resolver: zodResolver(reportSchema),
  });

  if (isLoading) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading')}
        description={t('loadingData', 'Loading data...')}
      />
    );
  }

  const buildReportParameters = (report: StockReportSchema, reportSystemName: string | undefined): string => {
    const newLine = '\r\n';
    const entries = [
      {
        display: displayFulfillment,
        type: ReportParameter.Fullfillment,
        value: (report.fulfillment ?? ['All']).join(','),
        desc: (report.fulfillment ?? [t('all', 'All')]).join(', '),
        label: t('fulfillment', 'Fulfillment'),
      },
      {
        display: displayPatient,
        type: ReportParameter.Patient,
        value: report.patientUuid ?? '',
        desc: report.patientName?.trim() ?? t('allPatients', 'All patients'),
        label: t('patients', 'Patients'),
      },
      {
        display: displayStockItem,
        type: ReportParameter.StockItem,
        value: report.stockItemUuid ?? '',
        desc: report.stockItemName?.trim() ?? t('allStockItems', 'All stock items'),
        label: t('stockItem', 'Stock Item'),
      },
      {
        display: displayStockItemCategory,
        type: ReportParameter.StockItemCategory,
        value: report.stockItemCategoryConceptUuid ?? '',
        desc: report.stockItemCategory?.trim() ?? t('allCategories', 'All categories'),
        label: t('stockItemCategory', 'Stock Item Category'),
      },
      {
        display: displayInventoryGroupBy,
        type: ReportParameter.InventoryGroupBy,
        value: report.inventoryGroupBy ?? 'LocationStockItemBatchNo',
        desc: report.inventoryGroupByName?.trim() ?? 'Stock Item Batch Number',
        label: t('inventoryGroupBy', 'Inventory group by'),
      },
      {
        display: displayLocation,
        type: ReportParameter.Location,
        value: report.locationUuid,
        desc: report.location?.trim() ?? '',
        label: t('location', 'Location'),
      },
      {
        display: displayLocation && displayChildLocations,
        type: ReportParameter.ChildLocations,
        value: report.childLocations ? 'true' : 'false',
        desc: report.childLocations ? t('yes', 'Yes') : t('no', 'No'),
        label: t('includeChildLocations', 'Include Child Locations'),
      },
      {
        display: displayMaxReorderLevelRatio,
        type: ReportParameter.MaxReorderLevelRatio,
        value: (report.maxReorderLevelRatio ?? 0).toString(),
        desc: `${(report.maxReorderLevelRatio ?? 0).toString()}%`,
        label: t('maxReorderLevelRatio', 'Max reorder level ratio'),
      },
      {
        display: displayStockSource,
        type: ReportParameter.StockSource,
        value: report.stockSourceUuid ?? '',
        desc: report.stockSource?.trim() ?? t('allSources', 'All sources'),
        label: t('stockSource', 'Stock source'),
      },
      {
        display: displayStockSourceDestination,
        type: ReportParameter.StockSourceDestination,
        value: report.stockSourceDestinationUuid ?? '',
        desc: report.stockSourceDestination?.trim() ?? t('allDestinations', 'All destinations'),
        label: t('stockSourceDestination', 'Stock source destination'),
      },
      {
        display: displayMostLeastMoving,
        type: ReportParameter.MostLeastMoving,
        value: report.mostLeastMoving ?? 'MostMoving',
        desc: report.mostLeastMovingName?.trim() ?? t('mostMoving', 'Most moving'),
        label: t('mostMoving', 'Most moving'),
      },
      {
        display: displayLimit,
        type: ReportParameter.Limit,
        value: (report.limit ?? getParamDefaultLimit(report.reportSystemName) ?? 20).toString(),
        desc: (report.limit ?? getParamDefaultLimit(report.reportSystemName) ?? 20).toString(),
        label: t(getReportLimitLabel(report.reportSystemName)),
      },
      {
        display: displayDate,
        type: ReportParameter.Date,
        value: report.date ? JSON.stringify(report.date).replaceAll('"', '') : '',
        desc: formatDisplayDate(report.date) ?? '',
        label: t('date', 'Date'),
      },
      {
        display: displayStartDate,
        type: ReportParameter.StartDate,
        value: report.startDate ? JSON.stringify(report.startDate).replaceAll('"', '') : '',
        desc: formatDisplayDate(report.startDate) ?? '',
        label: t(getReportStartDateLabel(report.reportSystemName)),
      },
      {
        display: displayEndDate,
        type: ReportParameter.EndDate,
        value: report.endDate ? JSON.stringify(report.endDate).replaceAll('"', '') : '',
        desc: formatDisplayDate(report.endDate) ?? '',
        label: t(getReportEndDateLabel(report.reportSystemName)),
      },
    ];

    let parameters = `param.report=${reportSystemName}${newLine}`;
    for (const entry of entries) {
      if (entry.display) {
        parameters += getReportParameter(entry.type, entry.value, entry.desc, entry.label, newLine);
      }
    }
    return parameters;
  };

  const handleSave = async (report: StockReportSchema) => {
    const reportSystemName = Array.isArray(reportTypes)
      ? reportTypes.find((reportType) => reportType.name === report.reportName)?.systemName
      : undefined;

    const newItem = {
      batchJobType: BatchJobTypeReport,
      description: report.reportName,
      parameters: buildReportParameters(report, reportSystemName),
    };
    await createBatchJob(newItem)
      .then((response) => {
        if (response.status === 201) {
          showSnackbar({
            title: t('batchJob', 'Batch Job'),
            subtitle: t('batchJobSuccess', 'Batch job created successfully'),
            kind: 'success',
          });
          handleMutate(`${restBaseUrl}/stockmanagement/batchjob?batchJobType=Report&v=default`);
          closeWorkspace();
        } else {
          showSnackbar({
            title: t('batchJobErrorTitle', 'Batch job'),
            subtitle: t('batchJobErrorMessage', 'Error creating batch job'),
            kind: 'error',
          });
          closeWorkspace();
        }
      })
      .catch(() => {
        showSnackbar({
          title: t('batchJobErrorTitle', 'Batch job'),
          subtitle: t('batchJobErrorMessage', 'Error creating batch job'),
          kind: 'error',
        });
        closeWorkspace();
      });
  };

  return (
    <Form className={styles.container} onSubmit={handleSubmit(handleSave)}>
      <Stack className={styles.form} gap={5}>
        <>
          <FormGroup legendText={t('reportName', 'Report name')}>
            <Controller
              control={control}
              name="reportName"
              render={({ field: { onChange } }) => (
                <ComboBox
                  id="report"
                  titleText={t('reportName', 'Report name')}
                  items={Array.isArray(reportTypes) ? reportTypes : [reportTypes]}
                  itemToString={(item) => item?.name ?? ''}
                  placeholder={t('filter', 'Filter...')}
                  onChange={({ selectedItem }) => {
                    const selectedName = selectedItem?.name ?? '';
                    onChange(selectedName);
                    handleReportNameChange(selectedName);
                  }}
                />
              )}
            />
          </FormGroup>
        </>

        {displayStockItemCategory && (
          <>
            <FormGroup legendText={t('stockItemCategory', 'Stock Item Category')}>
              <Controller
                control={control}
                name="stockReportItemCategory"
                render={({ field: { onChange } }) => (
                  <ComboBox
                    id="stockReportItem"
                    size="md"
                    titleText={t('stockItemCategory', 'Stock Item Category')}
                    items={stockItemCategories}
                    onChange={({ selectedItem }) => {
                      onChange(selectedItem?.uuid ?? '');
                    }}
                    itemToString={(item) => (item && item?.display ? `${item?.display}` : '')}
                    placeholder={t('filter', 'Filter...')}
                  />
                )}
              />
            </FormGroup>
          </>
        )}
        {displayStartDate && (
          <Controller
            control={control}
            name="startDate"
            render={({ field: { onChange, value } }) => (
              <DatePicker
                datePickerType="single"
                maxDate={formatForDatePicker(today())}
                locale="en"
                dateFormat={DATE_PICKER_CONTROL_FORMAT}
                onChange={onChange}
                value={value}
              >
                <DatePickerInput
                  id="startDate"
                  placeholder={DATE_PICKER_FORMAT}
                  labelText={t('startDate', 'Start date')}
                  invalid={!!errors?.startDate?.message}
                  invalidText={errors?.startDate?.message}
                />
              </DatePicker>
            )}
          />
        )}
        {displayEndDate && (
          <Controller
            control={control}
            name="endDate"
            render={({ field: { onChange, value } }) => (
              <DatePicker
                datePickerType="single"
                maxDate={formatForDatePicker(today())}
                locale="en"
                dateFormat={DATE_PICKER_CONTROL_FORMAT}
                onChange={onChange}
                value={value}
              >
                <DatePickerInput
                  id="endDate"
                  placeholder={DATE_PICKER_FORMAT}
                  labelText={t('endDate', 'End date')}
                  invalid={!!errors?.endDate?.message}
                  invalidText={errors?.endDate?.message}
                />
              </DatePicker>
            )}
          />
        )}
        {displayInventoryGroupBy && (
          <Select
            id="inventoryGroupBy"
            defaultValue={model?.inventoryGroupBy}
            invalid={!!errors?.inventoryGroupBy?.message}
            invalidText={errors?.inventoryGroupBy?.message}
            labelText={t('inventoryBy', 'Inventory by')}
            onChange={(e) => setValue('inventoryGroupBy', e.target.value)}
          >
            <SelectItem value="" text={t('selectOption', 'Select an option')} />
            <SelectItem value="StockItemOnly" text={t('stockItem', 'Stock Item')} />
            <SelectItem value="LocationStockItem" text={t('locationAndStockItem', 'Location and stock item')} />
            <SelectItem value="LocationStockItemBatchNo" text={t('locationAndBatchNo', 'Location and batch')} />
          </Select>
        )}
        {displayLocation && (
          <Select
            name="locationUuid"
            className="select-field"
            labelText={t('location', 'Location')}
            id="location"
            onChange={(e) => {
              const selectedLocation = stockLocations?.find((loc) => loc.id === e.target.value);
              setValue('locationUuid', e.target.value);
              setValue('location', selectedLocation?.name || '');
            }}
            defaultValue=""
            invalid={!!errors?.location?.message}
            invalidText={errors?.location?.message}
          >
            <SelectItem disabled hidden value="" text={t('chooseALocation', 'Choose a location')} />
            {(stockLocations ?? [])?.map((loc) => {
              return <SelectItem key={loc.id} value={loc.id} text={loc.name} />;
            })}
          </Select>
        )}
        {displayChildLocations && (
          <Controller
            control={control}
            name="childLocations"
            render={({ field: { onChange, value } }) => (
              <Checkbox
                id="childLocations"
                onChange={onChange}
                checked={value}
                labelText={t('includeChildLocations', 'Include Child Locations')}
              />
            )}
          />
        )}
        {displayMostLeastMoving && (
          <Controller
            control={control}
            name="mostLeastMoving"
            render={({ field: { onChange, value } }) => (
              <RadioButtonGroup name="mostLeastMoving" legendText={t('rank', 'Rank')} onChange={onChange} value={value}>
                <RadioButton value="MostMoving" id="mostLeastMovingMost" labelText={t('mostMoving', 'Most moving')} />
                <RadioButton
                  value="LeastMoving"
                  id="mostLeastMovingLeast"
                  labelText={t('leastMoving', 'Least Moving')}
                />
              </RadioButtonGroup>
            )}
          />
        )}
        {displayLimit && (
          <Controller
            control={control}
            name="limit"
            render={({ field: { onChange, value } }) => (
              <NumberInput
                id="limitTop"
                allowEmpty
                disableWheel
                hideSteppers
                value={value}
                onChange={onChange}
                label={t('limit', 'Limit')}
              />
            )}
          />
        )}
        {displayFulfillment && (
          <div className={styles.flexRow}>
            <Controller
              control={control}
              name="fulfillment"
              render={({ field: { onChange, value } }) => (
                <>
                  <Checkbox
                    id="allFulfillment"
                    checked={value?.includes('All')}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      if (isChecked) {
                        onChange(['All']);
                      } else {
                        onChange(value.filter((item) => item !== 'All'));
                      }
                    }}
                    labelText={t('all', 'All')}
                  />
                  <Checkbox
                    id="fullFulfillment"
                    checked={value?.includes('Full')}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      onChange(
                        isChecked
                          ? [...value.filter((item) => item !== 'All'), 'Full']
                          : value.filter((item) => item !== 'Full'),
                      );
                    }}
                    labelText={t('fullFulfillment', 'Full Fulfillment')}
                  />
                  <Checkbox
                    id="partialFulfillment"
                    checked={value?.includes('Partial')}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      onChange(
                        isChecked
                          ? [...value.filter((item) => item !== 'All'), 'Partial']
                          : value.filter((item) => item !== 'Partial'),
                      );
                    }}
                    labelText={t('partialFulfillment', 'Partial Fulfillment')}
                  />
                  <Checkbox
                    id="noneFulfillment"
                    checked={value?.includes('None')}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      onChange(
                        isChecked
                          ? [...value.filter((item) => item !== 'All'), 'None']
                          : value.filter((item) => item !== 'None'),
                      );
                    }}
                    labelText={t('noneFulfillment', 'Non Fulfillment')}
                  />
                </>
              )}
            />
          </div>
        )}
        {displayDate && (
          <Controller
            control={control}
            name="date"
            render={({ field: { onChange, value } }) => (
              <DatePicker
                datePickerType="single"
                maxDate={formatForDatePicker(today())}
                locale="en"
                dateFormat={DATE_PICKER_CONTROL_FORMAT}
                onChange={onChange}
                value={value}
              >
                <DatePickerInput
                  id="date"
                  placeholder={DATE_PICKER_FORMAT}
                  labelText={t('date', 'Date')}
                  invalid={!!errors?.date?.message}
                  invalidText={errors?.date?.message}
                />
              </DatePicker>
            )}
          />
        )}
      </Stack>

      <ButtonSet
        className={classNames(styles.buttonSet, {
          [styles.tablet]: isTablet,
          [styles.desktop]: !isTablet,
        })}
      >
        <Button kind="secondary" onClick={() => closeWorkspace()} className={styles.button}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button type="submit" className={styles.button}>
          {getCoreTranslation('save')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default CreateReport;
