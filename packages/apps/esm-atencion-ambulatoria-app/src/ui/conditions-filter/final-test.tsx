import { useConfig } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../config-schema';

import { useConditionsSearchFromConceptSet } from './conditions.resource';

/**
 * Componente de prueba final con el UUID correcto del ConceptSet
 */
const FinalTest: React.FC = () => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const [searchTerm, setSearchTerm] = useState('');
  const conceptSetUuid = config?.conditionConceptSets?.antecedentesPatologicos?.uuid;

  const { searchResults, conceptSet, error, isSearching } = useConditionsSearchFromConceptSet(
    searchTerm,
    conceptSetUuid,
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        width: '450px',
        backgroundColor: 'white',
        border: '3px solid #28a745',
        padding: '20px',
        borderRadius: '10px',
        boxShadow: '0 6px 12px rgba(0,0,0,0.3)',
        zIndex: 10000,
        fontSize: '14px',
      }}
    >
      <h3 style={{ margin: '0 0 15px 0', color: '#28a745' }}>
        {t('finalTestCorrectConceptSet', 'Test Final - ConceptSet Correcto')}
      </h3>

      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('typeAnemiaToTest', "Escribe 'Anemia' para probar...")}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid #28a745',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
      </div>

      <div
        style={{
          fontSize: '13px',
          marginBottom: '15px',
          backgroundColor: '#f8f9fa',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <div>
          <strong>{t('conceptSetUuid', 'ConceptSet UUID')}:</strong> {conceptSetUuid}
        </div>
        <div>
          <strong>{t('status', 'Estado')}:</strong> {isSearching ? t('loading', 'Cargando...') : t('ready', 'Listo')}
        </div>
        <div>
          <strong>{t('error', 'Error')}:</strong>{' '}
          {error ? `${t('error', 'Error')}: ${error.message}` : t('noErrors', 'Sin errores')}
        </div>
        <div>
          <strong>{t('conceptSetLoaded', 'ConceptSet cargado')}:</strong> {conceptSet ? t('yes', 'Sí') : t('no', 'No')}
        </div>
        {conceptSet?.setMembers && (
          <div>
            <strong>{t('membersFound', 'Miembros encontrados')}:</strong> {conceptSet.setMembers.length}
          </div>
        )}
      </div>

      {conceptSet?.setMembers && conceptSet.setMembers.length > 0 && (
        <div style={{ marginBottom: '15px', backgroundColor: '#d4edda', padding: '10px', borderRadius: '5px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#155724' }}>
            {t('conceptSetMembers', 'Miembros del ConceptSet')} ({conceptSet.setMembers.length}):
          </h4>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '12px' }}>
            {conceptSet.setMembers.map((member) => (
              <li key={member.uuid} style={{ marginBottom: '5px' }}>
                <strong>{member.name.display}</strong>
                <div style={{ fontSize: '11px', color: '#666' }}>UUID: {member.uuid}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          backgroundColor: searchResults.length > 0 ? '#d4edda' : '#fff3cd',
          padding: '10px',
          borderRadius: '5px',
        }}
      >
        <h4 style={{ margin: '0 0 10px 0' }}>
          {t('searchResults', 'Resultados de búsqueda')} ({searchResults.length}):
        </h4>
        {searchResults.length > 0 ? (
          <ul style={{ margin: '0', paddingLeft: '20px' }}>
            {searchResults.map((result) => (
              <li key={result.uuid} style={{ color: '#155724', fontWeight: 'bold', marginBottom: '5px' }}>
                {result.display}
                <div style={{ fontSize: '11px', color: '#666', fontWeight: 'normal' }}>UUID: {result.uuid}</div>
              </li>
            ))}
          </ul>
        ) : searchTerm ? (
          <div style={{ color: '#721c24', fontSize: '13px' }}>
            {t('noResultsForSearchTerm', 'No se encontraron resultados para "{{searchTerm}}"', { searchTerm })}
          </div>
        ) : (
          <div style={{ color: '#856404', fontSize: '13px' }}>
            {t('typeSampleTermsToSearch', 'Escribe "Anemia", "Labio", "Bebé" o "Falta" para buscar...')}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '15px',
          fontSize: '11px',
          color: '#666',
          borderTop: '1px solid #dee2e6',
          paddingTop: '10px',
        }}
      >
        <strong>{t('testUrl', 'URL de prueba')}:</strong>
        <br />
        /openmrs/ws/rest/v1/concept/{conceptSetUuid}?v=custom:(setMembers:(uuid,name))
      </div>
    </div>
  );
};

export default FinalTest;
