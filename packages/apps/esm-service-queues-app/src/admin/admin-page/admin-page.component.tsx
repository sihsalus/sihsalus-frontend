import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { EmptyCardIllustration, ErrorState, launchWorkspace2, useLayoutType, useSession } from '@openmrs/esm-framework';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { canManageServiceQueueCatalog, canManageServiceQueueRoomCatalog } from '../../permissions';
import { useQueueRooms, useQueuesMutable } from '../queue-admin.resource';
import styles from './admin-page.scss';
import QueueActionMenu from './queue-action-menu.component';
import QueueRoomActionMenu from './queue-room-action-menu.component';

const AdminPage = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'sm';
  const session = useSession();
  const canManageQueues = canManageServiceQueueCatalog(session?.user);
  const canManageQueueRooms = canManageServiceQueueRoomCatalog(session?.user);

  const { queues, isLoading: isLoadingQueues, error: queuesError } = useQueuesMutable();
  const { queueRooms, isLoading: isLoadingQueueRooms, error: queueRoomsError } = useQueueRooms();
  const queuesById = useMemo(() => new Map(queues?.map((queue) => [queue.uuid, queue]) ?? []), [queues]);
  const queueRoomsById = useMemo(
    () => new Map(queueRooms?.map((queueRoom) => [queueRoom.uuid, queueRoom]) ?? []),
    [queueRooms],
  );

  const queueTableHeaders = [
    {
      key: 'name',
      header: t('name', 'Name'),
    },
    {
      key: 'description',
      header: t('description', 'Description'),
    },
    {
      key: 'service',
      header: t('service', 'Service'),
    },
    {
      key: 'location',
      header: t('location', 'UPSS'),
    },
  ];

  const queueRoomTableHeaders = [
    {
      key: 'name',
      header: t('name', 'Name'),
    },
    {
      key: 'description',
      header: t('description', 'Description'),
    },
    {
      key: 'queue',
      header: t('queue', 'Queue'),
    },
  ];

  const handleAddQueue = useCallback(() => {
    launchWorkspace2('service-queues-service-form');
  }, []);

  const handleAddQueueRoom = useCallback(() => {
    launchWorkspace2('service-queues-room-workspace');
  }, []);

  const queueTableRows = useMemo(() => {
    return (
      queues?.map((queue) => ({
        id: queue.uuid,
        name: queue.name || queue.display,
        description: queue.description || '--',
        service: queue.service?.display || '--',
        location: queue.location?.display || '--',
      })) || []
    );
  }, [queues]);

  const queueRoomTableRows = useMemo(() => {
    return (
      queueRooms?.map((room) => ({
        id: room.uuid,
        name: room.name || room.display,
        description: room.description || '--',
        queue: room.queue?.display || '--',
      })) || []
    );
  }, [queueRooms]);

  return (
    <div className={styles.adminPage}>
      {/* Queues Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t('queues', 'Queues')}</h2>
          {!queuesError && canManageQueues && (
            <Button kind="ghost" renderIcon={(props) => <Add size={16} {...props} />} onClick={handleAddQueue}>
              {t('addQueue', 'Add queue')}
            </Button>
          )}
        </div>
        {isLoadingQueues ? (
          <DataTableSkeleton role="progressbar" zebra columnCount={5} rowCount={3} />
        ) : queuesError ? (
          <ErrorState error={queuesError} headerTitle={t('queues', 'Queues')} />
        ) : (
          <Layer>
            <DataTable
              rows={queueTableRows}
              headers={queueTableHeaders}
              isSortable
              size={responsiveSize}
              useZebraStyles
            >
              {({ rows, headers, getTableProps }) => (
                <TableContainer className={styles.tableContainer}>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader key={header.key}>{header.header}</TableHeader>
                        ))}
                        {canManageQueues ? <TableHeader aria-label={t('actions', 'Actions')} /> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => {
                        const queue = queuesById.get(row.id);

                        return (
                          <TableRow key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                            {canManageQueues ? (
                              <TableCell className="cds--table-column-menu">
                                {queue ? <QueueActionMenu queue={queue} /> : null}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            {queueTableRows.length === 0 && (
              <Tile className={styles.emptyState}>
                <EmptyCardIllustration />
                <p>{t('noQueuesToDisplay', 'No queues to display')}</p>
              </Tile>
            )}
          </Layer>
        )}
      </div>

      {/* Queue Rooms Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>{t('queueRooms', 'Queue rooms')}</h2>
          {!queueRoomsError && canManageQueueRooms && (
            <Button kind="ghost" renderIcon={(props) => <Add size={16} {...props} />} onClick={handleAddQueueRoom}>
              {t('addQueueRoom', 'Add queue room')}
            </Button>
          )}
        </div>
        {isLoadingQueueRooms ? (
          <DataTableSkeleton role="progressbar" zebra columnCount={4} rowCount={3} />
        ) : queueRoomsError ? (
          <ErrorState error={queueRoomsError} headerTitle={t('queueRooms', 'Queue rooms')} />
        ) : (
          <Layer>
            <DataTable
              rows={queueRoomTableRows}
              headers={queueRoomTableHeaders}
              isSortable
              size={responsiveSize}
              useZebraStyles
            >
              {({ rows, headers, getTableProps }) => (
                <TableContainer className={styles.tableContainer}>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader key={header.key}>{header.header}</TableHeader>
                        ))}
                        {canManageQueueRooms ? <TableHeader aria-label={t('actions', 'Actions')} /> : null}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => {
                        const queueRoom = queueRoomsById.get(row.id);

                        return (
                          <TableRow key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                            {canManageQueueRooms ? (
                              <TableCell className="cds--table-column-menu">
                                {queueRoom ? <QueueRoomActionMenu queueRoom={queueRoom} /> : null}
                              </TableCell>
                            ) : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
            {queueRoomTableRows.length === 0 && (
              <Tile className={styles.emptyState}>
                <EmptyCardIllustration />
                <p className={styles.emptyStateContent}>{t('noQueueRoomsToDisplay', 'No queue rooms to display')}</p>
              </Tile>
            )}
          </Layer>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
