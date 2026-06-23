/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Accordion, AccordionItem, Button, Checkbox } from '@carbon/react';
import { useConfig, useLayoutType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../../config-schema';
import { FilterEmptyState } from '../ui-elements/resetFiltersEmptyState/filter-empty-state.component';

import FilterContext from './filter-context';
import styles from './filter-set.scss';
import type { FilterLeafProps, FilterNodeProps, TreeCheckboxes, TreeNode } from './filter-types';

const isIndeterminate = (kids: string[] | undefined, checkboxes: TreeCheckboxes): boolean => {
  return kids && !kids?.every((kid) => checkboxes[kid]) && !kids?.every((kid) => !checkboxes[kid]);
};

interface FilterSetProps {
  hideFilterSetHeader?: boolean;
}

interface filterNodeParentProps extends Pick<FilterNodeProps, 'root'> {
  itemNumber: number;
}

function filterTreeNode(inputValue: string, treeNode: TreeNode): boolean {
  // If the tree node's display value contains the user input, or any of its children's display contains the user input, return true
  if (
    treeNode &&
    (treeNode.display.toLowerCase().includes(inputValue.toLowerCase()) ||
      (treeNode.subSets && treeNode.subSets.some((child) => filterTreeNode(inputValue, child))))
  ) {
    return true;
  }

  // Otherwise, return false
  return false;
}

const FilterSet: React.FC<FilterSetProps> = () => {
  const { roots } = useContext(FilterContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [treeDataFiltered, setTreeDataFiltered] = useState(roots);

  useEffect(() => {
    const filteredData = roots.filter((node) => filterTreeNode(searchTerm, node));
    setTreeDataFiltered(filteredData);
  }, [searchTerm, roots]);

  return (
    <div>
      <div className={styles.filterSetContent}>
        {treeDataFiltered?.length > 0 ? (
          treeDataFiltered?.map((root, index) => (
            <div className={`${styles.nestedAccordion} ${styles.nestedAccordionTablet}`} key={`filter-node-${index}`}>
              <FilterNodeParent root={root} itemNumber={index} />
            </div>
          ))
        ) : (
          <FilterEmptyState clearFilter={() => setSearchTerm('')} />
        )}
      </div>
    </div>
  );
};

const FilterNodeParent = ({ root, itemNumber }: filterNodeParentProps): React.JSX.Element | null => {
  const config = useConfig<ConfigObject>();
  const { t } = useTranslation();
  const tablet = useLayoutType() === 'tablet';
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);
  const { checkboxes, parents, updateParent } = useContext(FilterContext);

  if (!root.subSets) return;

  const affectedLeaves = parents[root.flatName] ?? [];
  const allChecked = affectedLeaves.length > 0 && affectedLeaves.every((leaf) => checkboxes[leaf]);

  const filterParent = root.subSets.map((node, key) => {
    if (!node.subSets?.length) {
      return (
        <div key={key}>
          <FilterLeaf leaf={node} />
        </div>
      );
    }

    return (
      <div key={key}>
        <FilterNode
          root={node}
          level={0}
          open={expandAll === undefined ? (config.resultsViewerConcepts[itemNumber]?.defaultOpen ?? false) : expandAll}
        />
      </div>
    );
  });

  return (
    <div>
      <div className={classNames(styles.treeNodeHeader, { [styles.treeNodeHeaderTablet]: tablet })}>
        <h5>{t(root.display)}</h5>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <Button
            className={styles.button}
            kind="ghost"
            size={tablet ? 'md' : 'sm'}
            onClick={() => updateParent(root.flatName)}
            disabled={!root.hasData}
          >
            <span>{t(allChecked ? 'deselectAll' : 'selectAll', allChecked ? 'Deselect all' : 'Select all')}</span>
          </Button>
          <Button
            className={styles.button}
            kind="ghost"
            size={tablet ? 'md' : 'sm'}
            onClick={() => setExpandAll((prevValue) => !prevValue)}
          >
            <span>{t(!expandAll ? `Expand all` : `Collapse all`)}</span>
          </Button>
        </div>
      </div>
      {filterParent}
    </div>
  );
};

const FilterNode = ({ root, level, open }: FilterNodeProps) => {
  const tablet = useLayoutType() === 'tablet';
  const { checkboxes, parents, updateParent } = useContext(FilterContext);
  const indeterminate = isIndeterminate(parents[root.flatName], checkboxes);
  const allChildrenChecked = parents[root.flatName]?.every((kid) => checkboxes[kid]);

  return (
    <Accordion align="start" size={tablet ? 'md' : 'sm'}>
      <AccordionItem
        title={
          <Checkbox
            id={root?.flatName}
            checked={root.hasData && allChildrenChecked}
            indeterminate={indeterminate}
            labelText={root?.display}
            onChange={() => updateParent(root.flatName)}
            disabled={!root.hasData}
          />
        }
        open={open ?? false}
      >
        <div style={{ paddingLeft: `${level > 0 ? 1 : 0}rem` }}>
          {!root?.subSets?.[0]?.obs &&
            root?.subSets?.map((node, index) => <FilterNode root={node} level={level + 1} key={index} />)}
          {root?.subSets?.[0]?.obs && root.subSets?.map((obs, index) => <FilterLeaf leaf={obs} key={index} />)}
        </div>
      </AccordionItem>
    </Accordion>
  );
};

const FilterLeaf = ({ leaf }: FilterLeafProps) => {
  const { checkboxes, toggleVal } = useContext(FilterContext);
  return (
    <div className={styles.filterItem}>
      <Checkbox
        id={leaf?.flatName}
        labelText={leaf?.display}
        checked={checkboxes?.[leaf.flatName]}
        onChange={() => toggleVal(leaf.flatName)}
        disabled={!leaf.hasData}
      />
    </div>
  );
};

export default FilterSet;
