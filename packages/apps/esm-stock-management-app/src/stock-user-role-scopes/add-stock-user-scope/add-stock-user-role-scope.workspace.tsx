import {
  Button,
  ButtonSet,
  Checkbox,
  CheckboxGroup,
  ComboBox,
  DatePicker,
  DatePickerInput,
  Form,
  FormGroup,
  InlineLoading,
  Select,
  SelectItem,
  Stack,
  Toggle,
} from '@carbon/react';
import { Save } from '@carbon/react/icons';
import {
  type DefaultWorkspaceProps,
  getCoreTranslation,
  restBaseUrl,
  showSnackbar,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { type ChangeEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DATE_PICKER_CONTROL_FORMAT,
  DATE_PICKER_FORMAT,
  formatForDatePicker,
  INVENTORY_ADMINISTRATOR_ROLE_UUID,
  INVENTORY_CLERK_ROLE_UUID,
  INVENTORY_DISPENSING_ROLE_UUID,
  INVENTORY_MANAGER_ROLE_UUID,
  INVENTORY_REPORTING_ROLE_UUID,
  today,
} from '../../constants';
import { ResourceRepresentation } from '../../core/api/api';
import { type Role } from '../../core/api/types/identity/Role';
import { type User } from '../../core/api/types/identity/User';
import { type UserRoleScope } from '../../core/api/types/identity/UserRoleScope';
import { type UserRoleScopeLocation } from '../../core/api/types/identity/UserRoleScopeLocation';
import { type UserRoleScopeOperationType } from '../../core/api/types/identity/UserRoleScopeOperationType';
import { type StockOperationType } from '../../core/api/types/stockOperation/StockOperationType';
import { extractErrorMessagesFromResponse } from '../../constants';
import { translateStockLocation, translateStockOperationType } from '../../core/utils/translationUtils';
import {
  useRoles,
  useStockOperationTypes,
  useStockTagLocations,
  useUser,
  useUsers,
} from '../../stock-lookups/stock-lookups.resource';
import { handleMutate } from '../../utils';
import { createOrUpdateUserRoleScope } from '../stock-user-role-scopes.resource';
import styles from './add-stock-user-role-scope.scss';

const MinDate: Date = today();

type AddStockUserRoleScopeProps = DefaultWorkspaceProps & {
  model?: UserRoleScope;
  editMode?: boolean;
};

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  return value === true || value === false ? value : fallback;
};

const getRoleValue = (role: Role): string => {
  const roleWithFallbacks = role as Role & { name?: string };
  return roleWithFallbacks?.role ?? roleWithFallbacks?.display ?? roleWithFallbacks?.name ?? roleWithFallbacks?.uuid ?? '';
};

const getRoleLabel = (role: Role): string => {
  const roleWithFallbacks = role as Role & { name?: string };
  return roleWithFallbacks?.display ?? roleWithFallbacks?.role ?? roleWithFallbacks?.name ?? roleWithFallbacks?.uuid ?? '';
};

const AddStockUserRoleScope: React.FC<AddStockUserRoleScopeProps> = ({ model, editMode, closeWorkspace }) => {
  const { t } = useTranslation();
  const currentUser = useSession();
  const [formModel, setFormModel] = useState<UserRoleScope>({
    ...model,
    enabled: model?.enabled ?? true,
    permanent: model?.permanent ?? true,
    locations: model?.locations ?? [],
    operationTypes: model?.operationTypes ?? [],
  });
  const isTablet = useLayoutType() === 'tablet';

  const [roles, setRoles] = useState<Role[]>([]);

  const loggedInUserUuid = currentUser?.user?.uuid;
  const [selectedUserUuid, setSelectedUserUuid] = useState<string | null>(null);
  const { data: user } = useUser(selectedUserUuid);

  // operation types
  const {
    types: { results: stockOperations },
    isLoading,
  } = useStockOperationTypes();

  // get users
  const { items: users, isLoading: loadingUsers } = useUsers({
    v: ResourceRepresentation.Default,
  });

  // get roles
  const { isLoading: loadingRoles } = useRoles({
    v: ResourceRepresentation.Default,
  });

  /* Only load locations tagged to perform stock related activities.
     Unless a location is tag as main store, main pharmacy or dispensing, it will not be listed here.
   */
  const { stockLocations, isLoading: isLoadingStockLocations } = useStockTagLocations();
  const onEnabledChanged = (): void => {
    const isEnabled = !formModel?.enabled;
    setFormModel({ ...formModel, enabled: isEnabled });
  };

  const onPermanentChanged = (): void => {
    const isPermanent = !formModel?.permanent;
    setFormModel({
      ...formModel,
      permanent: isPermanent,
      activeFrom: undefined,
      activeTo: undefined,
    });
  };

  const [filteredItems, setFilteredItems] = useState<User[]>([]);

  const usersResults = users?.results ?? [];
  const userSelectionItems = usersResults.filter((item) => item.uuid !== loggedInUserUuid);

  const filterItems = (query: string) => {
    if (query && query.trim() !== '') {
      const filtered = userSelectionItems
        .filter((item: any) => {
          const displayName = item?.person?.display ?? item?.display ?? '';
          return displayName?.toLowerCase().includes(query?.toLowerCase());
        });
      setFilteredItems(filtered);
      return;
    }

    setFilteredItems([]);
  };

  useEffect(() => {
    if (model?.userUuid) {
      setSelectedUserUuid(model.userUuid);
    }
  }, [model]);

  const handleSearchQueryChange = (query: string) => {
    filterItems(query);
  };

  const onStockOperationTypeChanged = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const operationType = formModel?.operationTypes?.find((x) => x.operationTypeUuid === event?.target?.value);
    if (operationType) {
      const newOperationTypes = [
        ...formModel.operationTypes.filter((x) => x.operationTypeUuid !== operationType?.operationTypeUuid),
      ];
      setFormModel({ ...formModel, operationTypes: newOperationTypes });
    } else {
      const stockOperationType = stockOperations?.find((x) => x.uuid === event?.target?.value);
      const operationType: UserRoleScopeOperationType = {
        operationTypeName: stockOperationType?.name,
        operationTypeUuid: stockOperationType?.uuid,
      } as unknown as UserRoleScopeOperationType;
      setFormModel({
        ...formModel,
        operationTypes: [...(formModel?.operationTypes ?? []), operationType],
      });
    }
  };

  const onLocationCheckBoxChanged = (event: ChangeEvent<HTMLInputElement>): void => {
    const selectedLocation = formModel?.locations?.find((x) => x.locationUuid === event?.target?.value);
    if (selectedLocation) {
      const newLocations = [
        ...(formModel?.locations?.filter((x) => x.locationUuid !== selectedLocation?.locationUuid) ?? []),
      ];
      setFormModel({ ...formModel, locations: newLocations });
    } else {
      const loc = stockLocations?.find((x) => x.id === event?.target?.value);
      const newLocation: UserRoleScopeLocation = {
        locationName: loc?.name,
        locationUuid: loc?.id,
        enableDescendants: false,
      } as unknown as UserRoleScopeLocation;
      const newLocations = [...(formModel?.locations ?? []), newLocation];
      setFormModel({ ...formModel, locations: newLocations });
    }
  };

  const findCheckedLocation = (location: fhir.Location): UserRoleScopeLocation | null => {
    const result = formModel?.locations?.filter((x) => x.locationUuid === location.id);
    return result && result.length > 0 ? result[0] : null;
  };

  const onActiveDatesChange = (dates: Date[]): void => {
    setFormModel({ ...formModel, activeFrom: dates[0], activeTo: dates[1] });
  };

  const onUserChanged = (data: { selectedItem: User }) => {
    const stockRolesUUIDs = [
      INVENTORY_CLERK_ROLE_UUID,
      INVENTORY_MANAGER_ROLE_UUID,
      INVENTORY_DISPENSING_ROLE_UUID,
      INVENTORY_REPORTING_ROLE_UUID,
      INVENTORY_ADMINISTRATOR_ROLE_UUID,
    ];

    const filteredStockRoles = data.selectedItem?.roles.filter((role) => stockRolesUUIDs.includes(role.uuid));
    setFormModel({ ...formModel, userUuid: data.selectedItem?.uuid });
    setRoles(filteredStockRoles ?? []);
    setSelectedUserUuid(data?.selectedItem?.uuid);
  };

  const onRoleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const rootLocations = stockLocations?.filter((x) => !x.id)?.map((x) => x.id);
    const filteredLocations =
      formModel?.locations?.filter(
        (x) => !rootLocations || rootLocations.length === 0 || !rootLocations.some((p) => p === x.locationUuid),
      ) ?? [];

    setFormModel({
      ...formModel,
      role: e.target.value,
      locations: filteredLocations,
    });
  };

  const isOperationChecked = (operationType: StockOperationType) => {
    return formModel?.operationTypes?.filter((x) => x.operationTypeUuid === operationType.uuid)?.length > 0;
  };

  const addStockUserRole = async (e) => {
    e.preventDefault();

    if (!formModel?.userUuid) {
      showSnackbar({
        title: t('errorSavingUserRoleScope', 'Error Saving user role scope'),
        kind: 'error',
        isLowContrast: true,
        subtitle: t('userRequired', 'User is required'),
      });
      return;
    }

    if (!formModel?.role) {
      showSnackbar({
        title: t('errorSavingUserRoleScope', 'Error Saving user role scope'),
        kind: 'error',
        isLowContrast: true,
        subtitle: t('roleRequired', 'Role is required'),
      });
      return;
    }

    if (formModel?.userUuid === loggedInUserUuid) {
      showSnackbar({
        title: t('errorSavingUserRoleScope', 'Error Saving user role scope'),
        kind: 'error',
        isLowContrast: true,
        subtitle: t(
          'userRoleScopeSelfUpdate',
          'User role scopes cannot be assigned to the logged in user from this screen.',
        ),
      });
      return;
    }

    const payload: UserRoleScope = {
      ...formModel,
      enabled: asBoolean(formModel?.enabled, true),
      permanent: asBoolean(formModel?.permanent, true),
      locations: formModel?.locations ?? [],
      operationTypes: formModel?.operationTypes ?? [],
    };

    createOrUpdateUserRoleScope(payload).then(
      () => {
        handleMutate(`${restBaseUrl}/stockmanagement/userrolescope`);
        showSnackbar({
          isLowContrast: true,
          title: t('addUserRole', 'Add User role'),
          kind: 'success',
          subtitle: t('successfullySaved', 'You have successfully saved user role scope'),
        });
        closeWorkspace();
      },
      (err) => {
        const errorMessages = extractErrorMessagesFromResponse(err);
        const hasSelfUpdateError = errorMessages.some((message) => message.includes('userrolescopes.userUuid.selfupdate'));
        const formattedError = errorMessages.map((message) => {
          if (message.includes('userrolescopes.userUuid.selfupdate')) {
            return t(
              'userRoleScopeSelfUpdate',
              'User role scopes cannot be assigned to the logged in user from this screen.',
            );
          }
          return message;
        });
        showSnackbar({
          title: t('errorSavingUserRoleScope', 'Error Saving user role scope'),
          kind: 'error',
          isLowContrast: true,
          subtitle: hasSelfUpdateError
            ? t('userRoleScopeSelfUpdate', 'User role scopes cannot be assigned to the logged in user from this screen.')
            : formattedError.join(', '),
        });
      },
    );
  };

  if (isLoading || loadingRoles || loadingUsers || isLoadingStockLocations) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading')}
        description={t('loadingData', 'Loading data...')}
      />
    );
  }

  const roleOptions = user?.roles ?? roles;
  const hasSelectedRoleOption = roleOptions?.some((role) => getRoleValue(role) === formModel?.role);

  return (
    <Form className={styles.container} onSubmit={addStockUserRole}>
      <Stack className={styles.form} gap={5}>
        <div>
          {users?.results?.length > 0 && (
            <FormGroup legendText={t('user', 'User')}>
              <ComboBox
                id="userName"
                initialSelectedItem={usersResults.find((user) => user.uuid === model?.userUuid) ?? null}
                items={filteredItems.length ? filteredItems : userSelectionItems}
                itemToString={(item) => {
                  if (!item || typeof item !== 'object') return '';
                  const itemWithPerson = item as { person?: { display?: string }; display?: string };
                  return `${itemWithPerson?.person?.display ?? itemWithPerson?.display ?? ''}`;
                }}
                titleText={t('user', 'User')}
                onChange={onUserChanged}
                onInputChange={handleSearchQueryChange}
                placeholder={t('filterUsers', 'Filter users')}
                shouldFilterItem={() => true}
                size="md"
              />
            </FormGroup>
          )}
        </div>
        <Select
          id="select-role"
          labelText={t('role', 'Role')}
          name="role"
          onChange={onRoleChange}
          value={formModel.role}
        >
          <SelectItem value={''} text={t('chooseARole', 'Choose a role')} />
          {editMode ? (
            <SelectItem key={formModel?.role} value={formModel?.role} text={formModel?.role} />
          ) : (
            <>
              {formModel?.role && !hasSelectedRoleOption && (
                <SelectItem key={formModel.role} value={formModel.role} text={formModel.role} />
              )}
              {roleOptions?.map((role) => {
                const roleValue = getRoleValue(role);
                if (!roleValue) {
                  return null;
                }
                return <SelectItem key={role.uuid ?? roleValue} value={roleValue} text={getRoleLabel(role)} />;
              })}
            </>
          )}
        </Select>
        <CheckboxGroup className={styles.checkboxGrid} legendText="">
          <Checkbox
            checked={formModel?.enabled}
            id="chk-userEnabled"
            labelText={t('enabled', 'Enabled')}
            onChange={onEnabledChanged}
            value={model?.enabled ? 'true' : 'false'}
          />
          <Checkbox
            checked={formModel?.permanent}
            id="chk-userPermanent"
            labelText={t('permanent', 'Permanent')}
            name="isPermanent"
            onChange={onPermanentChanged}
            value={model?.permanent ? 'true' : 'false'}
          />

          {!formModel?.permanent && (
            <DatePicker
              dateFormat={DATE_PICKER_CONTROL_FORMAT}
              datePickerType="range"
              light
              locale="en"
              minDate={formatForDatePicker(MinDate)}
              onChange={onActiveDatesChange}
            >
              <DatePickerInput
                id="date-picker-input-id-start"
                labelText={t('activeFrom', 'Active From')}
                placeholder={DATE_PICKER_FORMAT}
              />
              <DatePickerInput
                id="date-picker-input-id-finish"
                labelText={t('activeTo', 'Active To')}
                placeholder={DATE_PICKER_FORMAT}
              />
            </DatePicker>
          )}
        </CheckboxGroup>
        <FormGroup legendText={t('stockOperations', 'Stock operations')}>
          <span className={styles.subTitle}>
            {t('roleDescription', 'The role will be applicable to only selected stock operations.')}
          </span>
        </FormGroup>
        <CheckboxGroup className={styles.checkboxGrid} legendText="">
          {stockOperations?.length > 0 &&
            stockOperations.map((type) => {
              return (
                <div className={styles.flexRow}>
                  <Checkbox
                    checked={isOperationChecked(type)}
                    className={styles.checkbox}
                    id={type.uuid}
                    labelText={translateStockOperationType(t, type.name)}
                    onChange={(event) => onStockOperationTypeChanged(event)}
                    value={type.uuid}
                  />
                </div>
              );
            })}
        </CheckboxGroup>
        <FormGroup legendText={t('locations', 'Locations')}>
          <span className={styles.subTitle}>
            {t('toggleMessage', 'Use the toggle to apply this scope to the locations under the selected location.')}
          </span>
        </FormGroup>
        <CheckboxGroup className={styles.checkboxGrid} legendText="">
          {stockLocations?.length > 0 &&
            stockLocations.map((type) => {
              const checkedLocation = findCheckedLocation(type);

              const getToggledValue = (locationUuid) => {
                const location = checkedLocation?.locationUuid === locationUuid ? checkedLocation : null;
                return location?.enableDescendants === true;
              };

              return (
                <div className={styles.flexRow}>
                  <Checkbox
                    checked={checkedLocation != null}
                    className={styles.checkbox}
                    id={`chk-loc-child-${type.id}`}
                    key={`chk-loc-child-key-${type.id}`}
                    labelText={translateStockLocation(t, type.name)}
                    name="location"
                    onChange={(event) => onLocationCheckBoxChanged(event)}
                    value={type.id}
                  />
                  {checkedLocation && (
                    <Toggle
                      className={styles.toggle}
                      hideLabel
                      id={`tg-loc-child-${type.id}`}
                      key={`tg-loc-child-key-${type.id}`}
                      toggled={getToggledValue(type.id)}
                      size="sm"
                    />
                  )}
                </div>
              );
            })}
        </CheckboxGroup>
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
        <Button type="submit" className={styles.button} renderIcon={Save}>
          {getCoreTranslation('save')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default AddStockUserRoleScope;
