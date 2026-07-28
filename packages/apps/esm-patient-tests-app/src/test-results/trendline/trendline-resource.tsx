import { type FetchResponse, openmrsFetch, restBaseUrl, showSnackbar } from '@openmrs/esm-framework';
import { useMemo } from 'react';
import useSWR from 'swr';

import { type TreeNode } from '../filter/filter-types';
import { assessValue } from '../load-patient-test-data/helpers';

export function computeTrendlineData(treeNode: TreeNode): Array<TreeNode> {
  const tests: Array<TreeNode> = [];
  if (!treeNode) {
    return tests;
  }
  treeNode?.subSets.forEach((subNode) => {
    if (subNode?.obs) {
      const TreeNode = subNode;
      const assess = assessValue(TreeNode);
      tests.push({
        ...TreeNode,
        range: TreeNode.hiNormal && TreeNode.lowNormal ? `${TreeNode.lowNormal} - ${TreeNode.hiNormal}` : '',
        obs: TreeNode.obs.map((ob) => {
          const observation = ob as typeof ob & Pick<TreeNode, 'lowNormal' | 'hiNormal' | 'lowCritical' | 'hiCritical'>;

          return {
            ...ob,
            interpretation: assess(ob.value),
            lowNormal: observation.lowNormal ?? TreeNode.lowNormal,
            hiNormal: observation.hiNormal ?? TreeNode.hiNormal,
            lowCritical: observation.lowCritical ?? TreeNode.lowCritical,
            hiCritical: observation.hiCritical ?? TreeNode.hiCritical,
          };
        }),
      });
    } else if (subNode?.subSets) {
      const subTreesTests = computeTrendlineData(subNode); // recursion
      tests.push(...subTreesTests);
    }
  });
  return tests;
}

export function useObstreeData(
  patientUuid: string,
  conceptUuid: string,
): {
  isLoading: boolean;
  trendlineData: TreeNode;
  isValidating: boolean;
} {
  const { data, error, isLoading, isValidating } = useSWR<FetchResponse<TreeNode>, Error>(
    `${restBaseUrl}/obstree?patient=${patientUuid}&concept=${conceptUuid}`,
    openmrsFetch,
  );
  if (error) {
    showSnackbar({
      title: error.name,
      subtitle: error.message,
      kind: 'error',
      isLowContrast: false,
    });
  }

  const returnValue = useMemo(
    () => ({
      isLoading,
      trendlineData:
        computeTrendlineData(data?.data)?.[0] ??
        ({
          obs: [],
          display: '',
          hiNormal: 0,
          lowNormal: 0,
          units: '',
          range: '',
        } as TreeNode),
      isValidating,
    }),
    [data?.data, isLoading, isValidating],
  );

  return returnValue;
}
