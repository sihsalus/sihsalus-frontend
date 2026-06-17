import { type SectionDefinition } from '../../config-schema';

import { ContactSection } from './contact/contact-section.component';
import { DeathInfoSection } from './death-info/death-info-section.component';
import { DemographicsSection } from './demographics/demographics-section.component';
import { GenericSection } from './generic-section.component';
import { InsuranceSection } from './insurance/insurance-section.component';
import { RelationshipsSection } from './patient-relationships/relationships-section.component';

export interface SectionProps {
  sectionDefinition: SectionDefinition;
}

export function Section({ sectionDefinition }: SectionProps) {
  switch (sectionDefinition.id) {
    case 'demographics':
      return <DemographicsSection fields={sectionDefinition.fields} />;
    case 'death':
      return <DeathInfoSection fields={sectionDefinition.fields} />;
    case 'responsiblePerson':
      return (
        <>
          {sectionDefinition.fields.length ? <GenericSection sectionDefinition={sectionDefinition} /> : null}
          <RelationshipsSection defaultNewRelationship />
        </>
      );
    case 'relationships':
      return <RelationshipsSection />;
    case 'contact':
      return <ContactSection sectionDefinition={sectionDefinition} />;
    case 'insurance':
      return <InsuranceSection sectionDefinition={sectionDefinition} />;
    default:
      return <GenericSection sectionDefinition={sectionDefinition} />;
  }
}
