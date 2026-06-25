import React, { useContext } from 'react';

import { type viewOpts } from '../../types';
import { FilterContext } from '../filter/filter-context';

import TreeView from './tree-view.component';

interface TreeViewWrapperProps {
  patientUuid: string;
  basePath: string;
  testUuid: string;
  expanded: boolean;
  type: string;
  view?: viewOpts;
}

const TreeViewWrapper: React.FC<TreeViewWrapperProps> = (props) => {
  const { isLoading } = useContext(FilterContext);

  return <TreeView {...props} isLoading={isLoading} />;
};

export default TreeViewWrapper;
