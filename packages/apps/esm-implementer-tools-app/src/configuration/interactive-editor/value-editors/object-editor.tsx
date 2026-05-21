/* eslint-disable @typescript-eslint/no-explicit-any */
import { StructuredListBody, StructuredListCell, StructuredListRow, StructuredListWrapper, Tile } from '@carbon/react';
import { Type } from '@openmrs/esm-framework';
import cloneDeep from 'lodash-es/cloneDeep';

import type { ConfigValueDescriptor } from '../editable-value.component';

import styles from './object-editor.styles.scss';
import { ValueEditorField } from './value-editor-field';

interface ObjectEditorProps {
  element: ConfigValueDescriptor;
  valueObject: Record<string | symbol | number, any>;
  setValue: (value: Record<string | symbol | number, any>) => void;
}

export function ObjectEditor({ element, valueObject, setValue }: ObjectEditorProps) {
  return (
    <Tile className={styles.objectEditor}>
      <StructuredListWrapper>
        <StructuredListBody>
          {Object.entries(element).map(([key, schema]) =>
            !key.startsWith('_') ? (
              <StructuredListRow key={key}>
                <StructuredListCell>
                  <ValueEditorField
                    element={{ _value: key, _source: element._source }}
                    valueType={Type.String}
                    value={key}
                    onChange={(newKey) => {
                      const newValueObject = cloneDeep(valueObject);
                      newValueObject[newKey] = cloneDeep(valueObject[key]);
                      delete newValueObject[key];
                      setValue(newValueObject);
                    }}
                  />
                </StructuredListCell>
                <StructuredListCell>
                  <ValueEditorField
                    element={{
                      ...schema,
                      _value: valueObject[key],
                      _source: element._source,
                    }}
                    valueType={schema._type}
                    value={valueObject[key]}
                    onChange={(newValue) => {
                      const newValueObject = cloneDeep(valueObject);
                      newValueObject[key] = newValue;
                      setValue(newValueObject);
                    }}
                  />
                </StructuredListCell>
              </StructuredListRow>
            ) : null,
          )}
        </StructuredListBody>
      </StructuredListWrapper>
    </Tile>
  );
}
