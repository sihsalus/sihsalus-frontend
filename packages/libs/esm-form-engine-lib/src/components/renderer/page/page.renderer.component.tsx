import { Accordion, AccordionItem } from '@carbon/react';
import { ChevronDownIcon, ChevronUpIcon } from '@openmrs/esm-framework/src/internal';
import classNames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Waypoint } from 'react-waypoint';
import { type FormPage, type FormSection } from '../../../types';
import { isTrue } from '../../../utils/boolean-utils';
import { pageObserver } from '../../sidebar/page-observer';
import { SectionRenderer } from '../section/section-renderer.component';
import styles from './page.renderer.scss';

interface PageRendererProps {
  page: FormPage;
  isFormExpanded: boolean;
  isPreview?: boolean;
}

interface CollapsibleSectionContainerProps {
  section: FormSection;
  sectionIndex: number;
  visibleSections: FormSection[];
  isFormExpanded: boolean;
}

function PageRenderer({ page, isFormExpanded, isPreview = false }: PageRendererProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const visibleSections = useMemo(
    () =>
      page.sections.filter((section) => {
        const hasVisibleQuestions = section.questions.some((question) => !isTrue(question.isHidden));
        return !isTrue(section.isHidden) && hasVisibleQuestions;
      }),
    [page.sections],
  );

  const toggleCollapse = (): void => setIsCollapsed(!isCollapsed);

  useEffect(() => {
    setIsCollapsed(!isFormExpanded);

    return (): void => {
      if (!isPreview) pageObserver.removeInactivePage(page.id);
    };
  }, [isFormExpanded, page.id, isPreview]);

  return (
    <div>
      <Waypoint
        key={page.id}
        onEnter={() => {
          if (!isPreview) pageObserver.addActivePage(page.id);
        }}
        onLeave={() => {
          if (!isPreview) pageObserver.removeInactivePage(page.id);
        }}
        topOffset="40%"
        bottomOffset="40%"
      >
        <div id={page.id} className={styles.pageContent}>
          <div
            className={styles.pageHeader}
            onClick={toggleCollapse}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCollapse();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <p className={styles.pageTitle}>
              {t(page.label)}
              <span className={styles.collapseIconWrapper}>
                {isCollapsed ? (
                  <ChevronDownIcon className={styles.collapseIcon} aria-label="Expand" />
                ) : (
                  <ChevronUpIcon className={styles.collapseIcon} aria-label="Collapse" />
                )}
              </span>
            </p>
          </div>
          <div
            className={classNames({
              [styles.hiddenAccordion]: isCollapsed,
              [styles.accordionContainer]: !isCollapsed,
            })}
          >
            <Accordion>
              {visibleSections.map((section, index) => (
                <CollapsibleSectionContainer
                  key={`section-${section.label}`}
                  section={section}
                  sectionIndex={index}
                  visibleSections={visibleSections}
                  isFormExpanded={isFormExpanded}
                />
              ))}
            </Accordion>
          </div>
        </div>
      </Waypoint>
    </div>
  );
}

function CollapsibleSectionContainer({
  section,
  sectionIndex,
  visibleSections,
  isFormExpanded,
}: CollapsibleSectionContainerProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isSectionOpen, setIsSectionOpen] = useState(
    isFormExpanded && (section.isExpanded == null || isTrue(section.isExpanded)),
  );
  const previousFormExpanded = useRef(isFormExpanded);

  useEffect(() => {
    // Initial section state belongs to the schema; later expand/collapse-all actions override it.
    if (previousFormExpanded.current !== isFormExpanded) {
      setIsSectionOpen(isFormExpanded);
      previousFormExpanded.current = isFormExpanded;
    }
  }, [isFormExpanded]);

  return (
    <AccordionItem
      title={t(section.label)}
      open={isSectionOpen}
      className={classNames(styles.sectionContainer, {
        [styles.firstSection]: sectionIndex === 0,
        [styles.lastSection]: sectionIndex === visibleSections.length - 1,
      })}
    >
      <div className={styles.formSection}>
        <SectionRenderer section={section} />
      </div>
    </AccordionItem>
  );
}

export default PageRenderer;
