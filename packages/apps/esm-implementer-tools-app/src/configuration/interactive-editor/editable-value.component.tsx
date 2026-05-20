import { Button } from '@carbon/react';
import { EditIcon, ResetIcon } from '@openmrs/esm-framework';
import {
  type Config,
  type ConfigValue,
  clearConfigErrors,
  type Type,
  temporaryConfigStore,
  type Validator,
} from '@openmrs/esm-framework/src/internal';
import { cloneDeep, unset } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ImplementerToolsStore, implementerToolsStore } from '../../store';

import { DisplayValue } from './display-value';
import styles from './editable-value.styles.scss';
import { type CustomValueType, ValueEditor } from './value-editor';

export interface EditableValueProps {
  path: Array<string>;
  element: ConfigValueDescriptor;
  customType?: CustomValueType;
}

export interface ConfigValueDescriptor {
  _value: ConfigValue;
  _source: string;
  _default?: ConfigValue;
  _description?: string;
  _elements?: Config | ConfigValueDescriptor;
  _validators?: Array<Validator>;
  _type?: Type;
}

export default function EditableValue({ path, element, customType }: EditableValueProps) {
  const [valueString, setValueString] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeConfigRef = useRef<HTMLButtonElement>(null);
  const { t } = useTranslation();
  const pathKey = path.join('\u0000');

  const isCurrentPath = useCallback(
    (currentPath: Array<string> | null | undefined) => currentPath?.join('\u0000') === pathKey,
    [pathKey],
  );

  const closeEditor = () => {
    setEditing(false);
    setError(null);
  };

  const focusOnConfigPathBeingEdited = useCallback(() => {
    if (activeConfigRef && activeConfigRef.current) {
      setEditing(true);
      activeConfigRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const update = (state: ImplementerToolsStore) => {
      if (isCurrentPath(state.configPathBeingEdited)) {
        focusOnConfigPathBeingEdited();
      }
    };
    update(implementerToolsStore.getState());
    return implementerToolsStore.subscribe(update);
  }, [focusOnConfigPathBeingEdited, isCurrentPath]);

  useEffect(() => {
    const state = implementerToolsStore.getState();
    if (editing && !isCurrentPath(state.configPathBeingEdited)) {
      implementerToolsStore.setState({
        configPathBeingEdited: path,
        activeItemDescription: {
          path: path,
          source: element._source,
          description: element._description,
          value: valueString,
        },
      });
    }
    if (!editing && isCurrentPath(state.configPathBeingEdited)) {
      implementerToolsStore.setState({ configPathBeingEdited: null });
    }
  }, [editing, element._description, element._source, isCurrentPath, path, valueString]);

  return (
    <>
      <div className={styles.line}>
        {editing ? (
          <>
            <ValueEditor
              element={element}
              customType={customType}
              path={path}
              handleClose={closeEditor}
              handleSaveToConfiguration={(val) => {
                try {
                  const result = JSON.parse(val);
                  const tempConfigUpdate = set(cloneDeep(temporaryConfigStore.getState()), ['config', ...path], result);
                  clearConfigErrors(path.join('.'));
                  temporaryConfigStore.setState(tempConfigUpdate);
                  setValueString(val);
                  closeEditor();
                } catch (e) {
                  console.warn(e);
                  setError("That's not formatted quite right. Try again.");
                }
              }}
            />
          </>
        ) : (
          <div className={styles.elementValue}>
            <DisplayValue value={element._value} />
            <Button
              kind="ghost"
              size="sm"
              iconDescription={t('editValueButtonText', 'Edit')}
              onClick={() => setEditing(true)}
              ref={activeConfigRef}
              renderIcon={(props) => <EditIcon size={16} {...props} />}
              hasIconOnly
            />
            {element._source === 'temporary config' ? (
              <Button
                renderIcon={(props) => <ResetIcon size={16} {...props} />}
                size="sm"
                kind="ghost"
                iconDescription={t('resetToDefaultValueButtonText', 'Reset to default')}
                hasIconOnly
                onClick={() => {
                  clearConfigErrors(path.join('.'));
                  const state = cloneDeep(temporaryConfigStore.getState());
                  unset(state, ['config', ...path]);
                  temporaryConfigStore.setState(state);
                }}
              />
            ) : null}
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}
      </div>
    </>
  );
}

// A substitute for the lodash.set function, which seems to be broken,
// at least within Jest.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function set<T>(obj: T, path: Array<string>, value: any): T {
  if (path.length > 1) {
    obj[path[0]] = set(obj[path[0]] ?? {}, path.slice(1), value);
  } else {
    obj[path[0]] = value;
  }
  return obj;
}
