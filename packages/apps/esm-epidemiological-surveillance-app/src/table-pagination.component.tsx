import { Pagination } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onChange: (value: { page: number; pageSize: number }) => void;
}) {
  const { t } = useTranslation(moduleName);
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      pageSizes={[10, 20, 50]}
      totalItems={totalItems}
      onChange={onChange}
      backwardText={t("tablePagination.previous", "Página anterior")}
      forwardText={t("tablePagination.next", "Página siguiente")}
      itemsPerPageText={t("tablePagination.size", "Filas por página:")}
      pageNumberText={t("tablePagination.page", "Página")}
      pageSelectLabelText={() =>
        t("tablePagination.select", "Seleccionar página")
      }
      itemRangeText={(min, max, total) =>
        t("tablePagination.range", "{{min}}–{{max}} de {{total}} registros", {
          min,
          max,
          total,
        })
      }
      pageRangeText={(_current, total) =>
        t("tablePagination.pages", "de {{total}} páginas", { total })
      }
    />
  );
}
