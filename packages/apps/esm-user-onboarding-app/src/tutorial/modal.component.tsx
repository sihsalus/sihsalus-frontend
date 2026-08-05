import { Link, ModalBody, ModalHeader } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { navigate, useAppContext, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type Config } from '../config-schema';
import { type TutorialContext } from '../types';
import styles from './styles.scss';

interface TutorialModalProps {
  onClose: () => void;
}

const TutorialModal: React.FC<TutorialModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { tutorialData: tutorials } = useConfig<Config>();
  const tutorialContext = useAppContext<TutorialContext>('tutorial-context');

  const handleWalkthroughClick = (index: number) => {
    const basePath = globalThis.getOpenmrsSpaBase();
    const homePath = `${basePath}home`;
    const currentPath = globalThis.location.pathname;
    const tutorial = tutorials[index];

    const setTutorialSteps = () => {
      tutorialContext.setSteps(tutorial.steps);
      tutorialContext.setShowTutorial(true);
    };

    if (currentPath.startsWith(homePath)) {
      setTutorialSteps();
    } else {
      navigate({ to: homePath });

      // The poll must outlive this modal (it waits for the navigation to land),
      // but it needs an upper bound: if the user never reaches home (redirect,
      // route guard, manual navigation) it would otherwise run forever.
      let remainingTicks = 100;
      const intervalId = setInterval(() => {
        if (globalThis.location.pathname.startsWith(homePath)) {
          setTutorialSteps();
          clearInterval(intervalId);
        } else if (--remainingTicks <= 0) {
          clearInterval(intervalId);
        }
      }, 100);
    }
    onClose();
  };

  return (
    <React.Fragment>
      <ModalHeader closeModal={onClose} title={t('tutorial', 'Tutorial')}>
        <p className={styles.description}>
          {t('modalDescription', 'Find walkthroughs and video tutorials on some of the core features of OpenMRS.')}
        </p>
      </ModalHeader>
      <ModalBody className={styles.tutorialModal}>
        <ul>
          {tutorials.map((tutorial, index) => (
            <li className={styles.tutorialItem} key={index}>
              <h3 className={styles.tutorialTitle}>{tutorial.title}</h3>
              <p className={styles.tutorialDescription}>{tutorial.description}</p>
              <Link
                onClick={() => handleWalkthroughClick(index)}
                className={styles.tutorialLink}
                renderIcon={() => <ArrowRight aria-label="Arrow Right" />}
              >
                {t('walkthrough', 'Walkthrough')}
              </Link>
            </li>
          ))}
        </ul>
      </ModalBody>
    </React.Fragment>
  );
};

export default TutorialModal;
