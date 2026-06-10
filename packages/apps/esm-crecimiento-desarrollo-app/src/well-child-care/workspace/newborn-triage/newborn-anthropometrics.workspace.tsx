import {
  Button,
  ButtonSet,
  ButtonSkeleton,
  Column,
  Form,
  InlineNotification,
  NumberInputSkeleton,
  Row,
  Stack,
} from "@carbon/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createErrorHandler,
  showSnackbar,
  useConfig,
  useLayoutType,
  useSession,
} from "@openmrs/esm-framework";
import React, { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { credNeonatalEditPrivilege } from "../../../constants";
import type { ConfigObject } from "../../../config-schema";
import { DashboardAccess } from "../../../rbac";
import type { DefaultPatientWorkspaceProps } from "../../../types";
import {
  assessValue,
  getReferenceRangesForConcept,
  invalidateCachedVitalsAndBiometrics,
  saveVitalsAndBiometrics,
  useVitalsConceptMetadata,
} from "../../common";

import styles from "./newborn-vitals-form.scss";
import NewbornVitalsInput from "./newborn-vitals-input.component";
import { isValueWithinReferenceRange } from "./vitals-biometrics-form.utils";

const AnthropometricsSchema = z
  .object({
    weight: z.number(),
    height: z.number(),
    headCircumference: z.number(),
    chestCircumference: z.number(),
  })
  .partial()
  .refine((fields) => Object.values(fields).some((value) => Boolean(value)), {
    message: "Please fill at least one field",
    path: ["oneFieldRequired"],
  });

export type AnthropometricsFormType = z.infer<typeof AnthropometricsSchema>;

const NewbornAnthropometricsForm: React.FC<DefaultPatientWorkspaceProps> = ({
  closeWorkspace,
  workspaceProps,
}) => {
  const patientUuid = workspaceProps?.patientUuid ?? "";
  const { t } = useTranslation();
  const isTablet = useLayoutType() === "tablet";
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const {
    data: conceptUnits,
    conceptMetadata,
    conceptRanges,
    isLoading,
  } = useVitalsConceptMetadata();
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<AnthropometricsFormType>({
    mode: "all",
    resolver: zodResolver(AnthropometricsSchema),
  });

  const weight = watch("weight");

  const concepts = useMemo(
    () => ({
      weightRange: conceptRanges.get(config.concepts.weightUuid),
      heightRange: conceptRanges.get(config.concepts.heightUuid),
      headCircumferenceRange: conceptRanges.get(
        config.concepts.headCircumferenceUuid,
      ),
      chestCircumferenceRange: conceptRanges.get(
        config.concepts.chestCircumferenceUuid,
      ),
    }),
    [
      conceptRanges,
      config.concepts.weightUuid,
      config.concepts.heightUuid,
      config.concepts.headCircumferenceUuid,
      config.concepts.chestCircumferenceUuid,
    ],
  );

  const saveAnthropometrics = useCallback(
    (data: AnthropometricsFormType) => {
      setShowErrorMessage(true);
      setShowErrorNotification(false);

      const allFieldsAreValid = Object.entries(data)
        .filter(([, value]) => Boolean(value))
        .every(([key, value]) =>
          isValueWithinReferenceRange(
            conceptMetadata,
            config.concepts[`${key}Uuid`],
            value,
          ),
        );

      if (allFieldsAreValid) {
        setShowErrorMessage(false);
        const abortController = new AbortController();

        saveVitalsAndBiometrics(
          config.vitals.encounterTypeUuid,
          config.vitals.formUuid,
          config.concepts,
          patientUuid,
          data,
          abortController,
          session?.sessionLocation?.uuid,
        )
          .then((response) => {
            if (response.status === 201) {
              invalidateCachedVitalsAndBiometrics();
              closeWorkspace({ discardUnsavedChanges: true });
              showSnackbar({
                isLowContrast: true,
                kind: "success",
                title: t(
                  "anthropometricsRecorded",
                  "Datos AntropomÃ©tricos registrados",
                ),
                subtitle: t(
                  "anthropometricsNowAvailable",
                  "Ahora visibles en la pÃ¡gina de Datos AntropomÃ©tricos",
                ),
              });
            }
          })
          .catch(() => {
            createErrorHandler();
            showSnackbar({
              title: t(
                "anthropometricsSaveError",
                "Error guardando los datos antropomÃ©tricos",
              ),
              kind: "error",
              isLowContrast: false,
              subtitle: t(
                "checkForValidity",
                "Some of the values entered may be invalid",
              ),
            });
          })
          .finally(() => abortController.abort());
      } else {
        setShowErrorMessage(true);
      }
    },
    [
      closeWorkspace,
      conceptMetadata,
      config.concepts,
      config.vitals.encounterTypeUuid,
      config.vitals.formUuid,
      patientUuid,
      session?.sessionLocation?.uuid,
      t,
    ],
  );

  function onError(err) {
    if (err?.oneFieldRequired) {
      setShowErrorNotification(true);
    }
  }

  const content = isLoading ? (
    <Form className={styles.form}>
      <div className={styles.grid}>
        <Stack>
          <Column>
            <p className={styles.title}>
              {t("recordAnthropometrics", "Registrar Datos AntropomÃ©tricos")}
            </p>
          </Column>
          <Row className={styles.row}>
            <Column>
              <NumberInputSkeleton />
            </Column>
            <Column>
              <NumberInputSkeleton />
            </Column>
            <Column>
              <NumberInputSkeleton />
            </Column>
            <Column>
              <NumberInputSkeleton />
            </Column>
          </Row>
        </Stack>
      </div>
      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <ButtonSkeleton className={styles.button} />
        <ButtonSkeleton className={styles.button} />
      </ButtonSet>
    </Form>
  ) : (
    <Form className={styles.form}>
      <div className={styles.grid}>
        <Stack gap={4}>
          <Column>
            <p className={styles.title}>
              {t(
                "anthropometrics",
                "Datos AntropomÃ©tricos del ReciÃ©n Nacido",
              )}
            </p>
          </Column>
          <Row className={styles.row}>
            <NewbornVitalsInput
              control={control}
              fieldProperties={[
                {
                  name: t("weight", "Weight"),
                  type: "number",
                  min: concepts.weightRange?.lowAbsolute,
                  max: concepts.weightRange?.highAbsolute,
                  id: "weight",
                },
              ]}
              interpretation={
                weight &&
                assessValue(
                  weight,
                  getReferenceRangesForConcept(
                    config.concepts.weightUuid,
                    conceptMetadata,
                  ),
                )
              }
              showErrorMessage={showErrorMessage}
              label={t("weight", "Weight")}
              unitSymbol={conceptUnits.get(config.concepts.weightUuid) ?? "kg"}
            />
            <NewbornVitalsInput
              control={control}
              fieldProperties={[
                {
                  id: "height",
                  name: t("height", "Height"),
                  type: "number",
                  min: concepts.heightRange?.lowAbsolute,
                  max: concepts.heightRange?.highAbsolute,
                },
              ]}
              label={t("height", "Height")}
              unitSymbol={conceptUnits.get(config.concepts.heightUuid) ?? "cm"}
            />
            <NewbornVitalsInput
              control={control}
              fieldProperties={[
                {
                  id: "headCircumference",
                  name: t("headCircumference", "Head circumference"),
                  type: "number",
                  min: 25,
                  max: 50,
                },
              ]}
              label={t("headCircumference", "Head circumference")}
              unitSymbol={
                conceptUnits.get(config.concepts.headCircumferenceUuid) ?? "cm"
              }
            />
            <NewbornVitalsInput
              control={control}
              fieldProperties={[
                {
                  id: "chestCircumference",
                  name: t("chestCircumference", "Chest circumference"),
                  type: "number",
                  min: 20,
                  max: 45,
                },
              ]}
              label={t("chestCircumference", "Chest circumference")}
              unitSymbol={
                conceptUnits.get(config.concepts.chestCircumferenceUuid) ?? "cm"
              }
            />
          </Row>
        </Stack>
      </div>
      {showErrorNotification && (
        <Column className={styles.errorContainer}>
          <InlineNotification
            className={styles.errorNotification}
            lowContrast={false}
            onClose={() => setShowErrorNotification(false)}
            title={t("error", "Error")}
            subtitle={
              t("pleaseFillField", "Please fill at least one field") + "."
            }
          />
        </Column>
      )}
      <ButtonSet className={isTablet ? styles.tablet : styles.desktop}>
        <Button
          className={styles.button}
          kind="secondary"
          onClick={() => closeWorkspace()}
        >
          {t("discard", "Discard")}
        </Button>
        <Button
          className={styles.button}
          kind="primary"
          onClick={handleSubmit(saveAnthropometrics, onError)}
          disabled={isSubmitting}
          type="submit"
        >
          {t("submit", "Save and close")}
        </Button>
      </ButtonSet>
    </Form>
  );

  return (
    <DashboardAccess privilege={credNeonatalEditPrivilege}>
      {content}
    </DashboardAccess>
  );
};

export default NewbornAnthropometricsForm;
