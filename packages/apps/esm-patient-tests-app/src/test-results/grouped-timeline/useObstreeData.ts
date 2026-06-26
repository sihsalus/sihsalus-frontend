import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { usePatientChartStore } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';

import { type ObservationData, type TreeNode } from '../filter/filter-types';
import { assessValue, exist } from '../loadPatientTestData/helpers';

export const getName = (prefix: string | undefined, name: string) => {
  return prefix ? `${prefix}-${name}` : name;
};

interface ObsTreeNode extends Omit<TreeNode, 'subSets' | 'obs'> {
  flatName: string;
  display: string;
  hasData: boolean;
  subSets: Array<ObsTreeNode>;
  obs: Array<ObservationData>;
}

const emptyObsTree: ObsTreeNode = {
  display: '',
  flatName: '',
  hasData: false,
  subSets: [],
  obs: [],
};

const getFetchData = (responseData: FetchResponse<ObsTreeNode> | ObsTreeNode | undefined): ObsTreeNode =>
  ((responseData as FetchResponse<ObsTreeNode>)?.data ?? responseData ?? emptyObsTree) as ObsTreeNode;

const augmentObstreeData = (node: ObsTreeNode, prefix: string | undefined): ObsTreeNode => {
  const outData: ObsTreeNode = JSON.parse(JSON.stringify(node));
  outData.flatName = getName(prefix, node.display);
  outData.hasData = false;

  if (outData?.subSets?.length) {
    outData.subSets = outData.subSets.map((subNode: ObsTreeNode) =>
      augmentObstreeData(subNode, getName(prefix, node?.display)),
    );
    outData.hasData = outData.subSets.some((subNode: ObsTreeNode) => subNode.hasData);
  }
  if (exist(outData?.hiNormal, outData?.lowNormal)) {
    outData.range = `${outData.lowNormal} – ${outData.hiNormal}`;
  }
  if (outData?.obs?.length) {
    outData.obs = outData.obs.map((ob) => {
      const obRange = exist((ob as any).hiNormal, (ob as any).lowNormal)
        ? `${(ob as any).lowNormal} – ${(ob as any).hiNormal}`
        : ((ob as any).range ?? outData.range);
      const obMeta = {
        ...outData,
        lowNormal: (ob as any).lowNormal ?? outData.lowNormal,
        hiNormal: (ob as any).hiNormal ?? outData.hiNormal,
        lowCritical: (ob as any).lowCritical ?? outData.lowCritical,
        hiCritical: (ob as any).hiCritical ?? outData.hiCritical,
        lowAbsolute: (ob as any).lowAbsolute ?? outData.lowAbsolute,
        hiAbsolute: (ob as any).hiAbsolute ?? outData.hiAbsolute,
        range: obRange,
      };
      const assess = assessValue(obMeta);
      return {
        ...ob,
        interpretation: assess(ob.value),
        range: obRange,
      };
    });
    outData.hasData = true;
  }

  return outData;
};

const filterTreeWithData = (node: ObsTreeNode): ObsTreeNode => {
  if (!node.subSets?.length) {
    return node;
  }

  return {
    ...node,
    subSets: node.subSets
      .map(filterTreeWithData)
      .filter((subNode) => subNode.hasData || Boolean(subNode.subSets?.length)),
  };
};

const useGetObstreeData = (patientUuidOrConceptUuid: string, maybeConceptUuid?: string) => {
  const { patientUuid: chartPatientUuid } = usePatientChartStore();
  const patientUuid = maybeConceptUuid ? patientUuidOrConceptUuid : chartPatientUuid;
  const conceptUuid = maybeConceptUuid ?? patientUuidOrConceptUuid;
  const response = useSWR<FetchResponse<ObsTreeNode>, Error>(
    patientUuid ? `${restBaseUrl}/obstree?patient=${patientUuid}&concept=${conceptUuid}` : null,
    openmrsFetch,
  );
  const result = useMemo(() => {
    if (response.data) {
      const { data, ...rest } = response;
      const newData = augmentObstreeData(getFetchData(data), '');
      return { ...rest, loading: false, data: newData };
    } else {
      return {
        data: emptyObsTree,
        error: false,
        loading: true,
      };
    }
  }, [response]);
  return result;
};

const useGetManyObstreeData = (patientUuidOrUuidArray: string | Array<string>, maybeUuidArray?: Array<string>) => {
  const { patientUuid: chartPatientUuid } = usePatientChartStore();
  const patientUuid = Array.isArray(patientUuidOrUuidArray) ? chartPatientUuid : patientUuidOrUuidArray;
  const uuidArray = Array.isArray(patientUuidOrUuidArray) ? patientUuidOrUuidArray : (maybeUuidArray ?? []);
  const getObstreeUrl = (index: number) => {
    if (index < uuidArray.length && patientUuid) {
      return `${restBaseUrl}/obstree?patient=${patientUuid}&concept=${uuidArray[index]}`;
    } else return null;
  };
  const { data, error } = useSWRInfinite(getObstreeUrl, openmrsFetch, {
    initialSize: uuidArray.length,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const result = useMemo(() => {
    return (
      data?.map((resp, index) => {
        if (resp?.data) {
          const { data, ...rest } = resp;
          const root = filterTreeWithData(augmentObstreeData(getFetchData(data), ''));
          const newData = {
            ...root,
            conceptUuid: typeof root.conceptUuid === 'string' ? root.conceptUuid : uuidArray[index],
          };
          return { ...rest, loading: false, data: newData };
        } else {
          return {
            data: emptyObsTree,
            error: false,
            loading: true,
          };
        }
      }) || [
        {
          data: emptyObsTree,
          error: false,
          loading: true,
        },
      ]
    );
  }, [data, uuidArray]);
  const roots = result.map((item) => item.data);
  const isLoading = result.some((item) => item.loading);

  return { roots, isLoading, error };
};

export default useGetManyObstreeData;
export { useGetManyObstreeData, useGetObstreeData };
