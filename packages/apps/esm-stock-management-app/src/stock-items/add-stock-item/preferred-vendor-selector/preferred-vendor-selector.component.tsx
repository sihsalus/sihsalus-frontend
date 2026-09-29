import { ComboBox, TextInputSkeleton } from '@carbon/react';
import { type ReactNode } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';
import { ResourceRepresentation } from '../../../core/api/api';
import { type StockSource } from '../../../core/api/types/stockOperation/StockSource';
import { useStockSources } from '../../../stock-sources/stock-sources.resource';

interface PreferredVendorSelectorProps<T extends FieldValues, C, O> {
  onPreferredVendorChange?: (unit: StockSource | null | undefined) => void;
  title?: string;
  placeholder?: string;
  invalid?: boolean;
  invalidText?: ReactNode;

  // Control
  controllerName: FieldPath<T>;
  name: string;
  control: Control<T, C, O>;
}

const PreferredVendorSelector = <T extends FieldValues, C, O>(props: PreferredVendorSelectorProps<T, C, O>) => {
  const {
    items: { results: sourcesList },
    isLoading,
  } = useStockSources({
    v: ResourceRepresentation.Default,
  });

  if (isLoading) {
    return <TextInputSkeleton />;
  }

  return (
    <Controller
      name={props.controllerName}
      control={props.control}
      render={({ field: { onChange, value, ref } }) => (
        <ComboBox
          titleText={props.title}
          id={props.name}
          size={'md'}
          items={sourcesList || []}
          onChange={(data: { selectedItem: StockSource | null | undefined }) => {
            props.onPreferredVendorChange?.(data.selectedItem);
            onChange(data.selectedItem?.uuid);
          }}
          selectedItem={sourcesList?.find((p) => p.uuid === value) ?? null}
          itemToString={(item?: StockSource) => (item?.name ? item.name : '')}
          shouldFilterItem={() => true}
          placeholder={props.placeholder}
          ref={ref}
          invalid={props.invalid}
          invalidText={props.invalidText}
        />
      )}
    />
  );
};

export default PreferredVendorSelector;
