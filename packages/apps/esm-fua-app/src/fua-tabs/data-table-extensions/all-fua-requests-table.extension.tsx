import React from 'react';

import FuaRequestTable from '../../fua/fua-request-table';

const AllFuaRequestsTable: React.FC = () => {
  return <FuaRequestTable statusFilter="all" />;
};

export default AllFuaRequestsTable;
