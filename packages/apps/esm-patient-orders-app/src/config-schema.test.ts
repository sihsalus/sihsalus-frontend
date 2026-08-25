import { configSchema } from './config-schema';

describe('patient orders configuration defaults', () => {
  it('routes interconsultation orders to their dedicated basket form and catalog', () => {
    const interconsultationOrder = configSchema.orderTypes._default.find(
      (orderType) => orderType.orderTypeUuid === 'f3c2e4b6-8b5a-11e5-8e9b-12345678901b',
    );

    expect(interconsultationOrder).toMatchObject({
      label: 'Órdenes de interconsulta',
      orderableConceptSets: ['4bf3f465-ac91-44fa-9b1f-173daf0c89a0'],
      formWorkspaceName: 'request-interconsulta-workspace',
    });
  });
});
