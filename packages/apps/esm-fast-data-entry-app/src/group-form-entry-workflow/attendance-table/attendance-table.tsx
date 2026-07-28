import {
  Button,
  Checkbox,
  CheckboxSkeleton,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Edit } from '@carbon/react/icons';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddGroupModal from '../../add-group-modal/add-group-modal';
import GroupFormWorkflowContext from '../../context/group-form-workflow-context';

const PatientRow = ({ patient }) => {
  const { patientUuids, addPatientUuid, removePatientUuid } = useContext(GroupFormWorkflowContext);
  const givenName = patient?.name?.[0]?.given?.[0];
  const familyName = patient?.name?.[0]?.family;
  const identifier = patient?.identifier?.[0]?.value;

  const handleOnChange = (_e, { checked }) => {
    if (checked) {
      addPatientUuid(patient.id);
    } else {
      removePatientUuid(patient.id);
    }
  };

  if (!patient) {
    return (
      <TableRow>
        <TableCell>
          <SkeletonText />
        </TableCell>
        <TableCell>
          <SkeletonText />
        </TableCell>
        <TableCell>
          <CheckboxSkeleton />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell>{patient.display || patient.displayName || [givenName, familyName].join(' ')}</TableCell>
      <TableCell>{identifier}</TableCell>
      <TableCell>
        <Checkbox
          checked={patientUuids.includes(patient.id)}
          labelText={patient.id}
          hideLabel
          id={`${identifier}-attendance-checkbox`}
          onChange={handleOnChange}
        />
      </TableCell>
    </TableRow>
  );
};

const AttendanceTable = ({ patients }) => {
  const { t } = useTranslation();
  const { activeGroupUuid, activeGroupName, activeGroupMembers } = useContext(GroupFormWorkflowContext);

  const [isOpen, setOpen] = useState(false);

  const headers = [t('name', 'Name'), t('identifier', 'Patient ID'), t('patientIsPresent', 'Patient is present')];

  const onPostCancel = useCallback(() => {
    setOpen(false);
  }, []);

  const onPostSubmit = useCallback(() => {
    setOpen(false);
  }, []);

  const newArr = useMemo(() => {
    return activeGroupMembers.map(function (value) {
      const patient = patients.find((patient) => patient.id === value);
      return { uuid: value, ...patient };
    });
  }, [activeGroupMembers, patients]);

  if (!activeGroupUuid) {
    return <div>{t('selectGroupFirst', 'Please select a group first')}</div>;
  }

  return (
    <div>
      <span style={{ flexGrow: 1 }} />
      <Button kind="ghost" onClick={() => setOpen(true)}>
        {t('editGroup', 'Edit Group')}&nbsp;
        <Edit size={20} />
      </Button>
      <AddGroupModal
        {...{
          cohortUuid: activeGroupUuid,
          patients: newArr,
          isCreate: false,
          groupName: activeGroupName,
          isOpen: isOpen,
          onPostCancel: onPostCancel,
          onPostSubmit: onPostSubmit,
        }}
      />
      <Table>
        <TableHead>
          <TableRow>
            {headers.map((header, index) => (
              <TableHeader key={index}>{header}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {activeGroupMembers.map((patientUuid, index) => {
            const patient = patients.find((patient) => patient.id === patientUuid);
            return <PatientRow patient={patient} key={index} />;
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AttendanceTable;
