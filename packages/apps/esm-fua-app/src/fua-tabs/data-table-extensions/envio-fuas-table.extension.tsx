import React from 'react';

import FuaRequestTable from '../../fua/fua-request-table';

const EnvioFuasTable: React.FC = () => {
  return <FuaRequestTable statusFilter="declined" />;
};

export default EnvioFuasTable;
