/**
 * This is the root test for this page. It simply checks that the page
 * renders. If the components of your page are highly interdependent,
 * (e.g., if the `Root` component had state that communicated
 * information between `Greeter` and `PatientGetter`) then you might
 * want to do most of your testing here. If those components are
 * instead quite independent (as is the case in this example), then
 * it would make more sense to test those components independently.
 *
 * The key thing to remember, always, is: write tests that behave like
 * users. They should *look* for elements by their visual
 * characteristics, *interact* with them, and (mostly) *assert* based
 * on things that would be visually apparent to a user.
 *
 * To learn more about how we do testing, see the following resources:
 *   https://o3-docs.vercel.app/docs/frontend-modules/testing
 *   https://kentcdodds.com/blog/how-to-know-what-to-test
 *   https://kentcdodds.com/blog/testing-implementation-details
 *   https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
 *
 * Kent C. Dodds is the inventor of `@testing-library`:
 *   https://testing-library.com/docs/guiding-principles
 */

import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';
import type { Config } from './config-schema';
import Root from './root.component';

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ element, children }: { element?: React.ReactNode; children?: React.ReactNode }) => element ?? children,
}));

/**
 * This is an idiomatic way of dealing with mocked files. Note that
 * `useConfig` is already mocked; the Jest moduleNameMapper (see the
 * Jest config) has mapped the `@openmrs/esm-framework` import to a
 * mock file. This line just tells TypeScript that the object is, in
 * fact, a mock, and so will have methods like `mockReturnValue`.
 */
const mockUseConfig = vi.mocked(useConfig<Config>);

it('renders the emergency dashboard', () => {
  const config: Config = {
    emergencyTriageQueueUuid: 'b1c5bb01-d78f-4f7e-b66d-b8bfe6887cf0',
    emergencyAttentionQueueUuid: '45f84a43-b406-4169-afe8-c07bd28b2616',
    emergencyServiceUuid: 'd62d58e9-ec91-4108-9643-00f5f23bf51c',
    emergencyLocationUuid: '44c3efb0-2583-4c80-a79e-1f756a03c0a1',
    upssEmergencyLocationUuid: '35d2234e-129a-4c40-abb2-1ae0b2400003',
    queueStatuses: {
      waitingUuid: '51ae5e4d-b72b-4912-bf31-a17efb690aeb',
      inServiceUuid: 'ca7494ae-437f-4fd0-8aae-b88b9a2ba47d',
      finishedServiceUuid: 'b559fb77-4e1e-4285-b9b7-1d03e0ba983f',
    },
    priorityConfigs: [],
    concepts: {
      priorityIConceptUuid: '',
      priorityIIConceptUuid: '',
      priorityIIIConceptUuid: '',
      priorityIVConceptUuid: '',
      emergencyConceptUuid: 'mocked-emergency-concept-uuid',
      urgencyConceptUuid: 'mocked-urgency-concept-uuid',
    },
    triageEncounter: {
      encounterTypeUuid: 'd7151f82-c1f3-4152-a605-2f9ea7414a79',
      vitalSignsConcepts: {
        temperatureUuid: '5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        heartRateUuid: '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        respiratoryRateUuid: '5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        systolicBpUuid: '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        diastolicBpUuid: '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        oxygenSaturationUuid: '5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        consciousnessLevelUuid: '162643AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        weightUuid: '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        heightUuid: '5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        anamnesisUuid: '6d99603e-ae9d-4838-8a09-ba75e27ff1e9',
        illnessDurationUuid: '577876b1-0b6e-4c57-b4c3-7af969a1d501',
        onsetTypeUuid: '34e03399-cb72-484b-85b8-616ef19919c1',
        courseUuid: 'e7d98188-16ba-4ef3-aed9-e891680bacf9',
        clinicalExamUuid: '830f3546-14fb-4d45-b889-a736b85a039c',
      },
    },
    attentionEncounter: {
      encounterTypeUuid: '1b70fe57-92c1-4e35-87f7-13d0e04ff12f',
      concepts: {
        diagnosisUuid: '6080231e-f27e-4ee6-93ba-ea2ca0bf2906',
        treatmentUuid: 'b8723c0f-b7e5-4ab2-bda6-dc59616a428e',
        auxiliaryExamsUuid: '291971f3-d912-4b7f-946a-9d071c888a9f',
      },
    },
    autoRefreshInterval: 30000,
    emergencyVisitTypeUuid: '',
    autoCreateVisitOnPatientSelect: true,
    promptVisitCreationOnNewPatient: true,
    patientRegistration: {
      defaultIdentifierTypeUuid: '550e8400-e29b-41d4-a716-446655440001',
      foreignCardIdentifierTypeUuid: '550e8400-e29b-41d4-a716-446655440002',
      passportIdentifierTypeUuid: '550e8400-e29b-41d4-a716-446655440003',
      dieIdentifierTypeUuid: '8d793bee-c2cc-11de-8d13-0010c6dffd0f',
      liveBirthCertificateIdentifierTypeUuid: '8d79403a-c2cc-11de-8d13-0010c6dffd0f',
      defaultLocationUuid: '',
      phoneNumberAttributeTypeUuid: '14d4f066-15f5-102d-96e4-000c29c2a5d7',
      identifierSourceUuid: '8549f706-7e85-4c1d-9424-217d50a2988b',
      openMrsIdIdentifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      unknownPatientAttributeTypeUuid: '8b56eac7-5c76-4b9c-8c6f-1deab8d3fc47',
      insuranceTypeAttributeTypeUuid: '56188294-b42c-481d-a987-4b495116c580',
      insuranceCodeAttributeTypeUuid: '374b130f-7457-476f-87b1-f182aa77c434',
      companionNameAttributeTypeUuid: '4697d0e6-5b24-416b-aee6-708cd9a3a1db',
      companionAgeAttributeTypeUuid: '70ce4571-2e2e-44da-a39f-9dae2a658606',
      companionRelationshipAttributeTypeUuid: 'a180fa5f-c44e-4490-a981-d7196b70c6ac',
      insuranceTypeConcepts: {
        sisGratuitoUuid: 'b61a9ff9-1485-4388-9f67-9c341f847f85',
        sisEmprendedorUuid: 'cc6958d9-7948-4f29-b244-4ff896c0b2ee',
        sisSemicontributivoUuid: 'e43e0a71-0b5d-4fc2-b599-a76e4562ae5a',
        essaludUuid: 'af799b5e-313c-4352-80c4-5007dcd42f29',
        privateUuid: 'ec420364-fde1-452d-9c48-fafb4ea73a58',
        noneUuid: 'c69b424f-4d9c-4ba9-aeae-045ff5a5e530',
      },
    },
  };
  mockUseConfig.mockReturnValue(config);

  render(<Root />);

  expect(screen.getByText(/emergency services/i)).toBeInTheDocument();
});
