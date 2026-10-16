import { Button, Checkbox } from "@carbon/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { moduleName } from "./constants";
import type { GeographicFocus, GeographicReport } from "./geographic.resource";
import styles from "./geographic.scss";

export const riskColors = {
  VERY_HIGH: "#da1e28",
  HIGH: "#ff832b",
  MEDIUM: "#f1c21b",
  LOW: "#24a148",
};
export function project(latitude: number, longitude: number) {
  const sin = Math.sin(
    (Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI) / 180,
  );
  return {
    x: (longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}
export function initialViewport(foci: GeographicFocus[]) {
  const points = foci.flatMap((f) =>
    f.latitude != null && f.longitude != null
      ? [project(f.latitude, f.longitude)]
      : [],
  );
  if (!points.length) return { ...project(-3.75, -73.25), zoom: 7 };
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    top = Math.min(...ys),
    bottom = Math.max(...ys);
  const zoom = Math.max(
    2,
    Math.min(
      13,
      Math.floor(
        Math.log2(
          Math.min(
            600 / Math.max((right - left) * 256, 1),
            300 / Math.max((bottom - top) * 256, 1),
          ),
        ),
      ),
    ),
  );
  return { x: (left + right) / 2, y: (top + bottom) / 2, zoom };
}
export function FocusSymbol({
  classification,
  color,
}: {
  classification: GeographicFocus["classification"];
  color: string;
}) {
  return (
    <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden="true">
      {classification === "RESIDUAL" ? (
        <path d="M 0 -10 L 10 9 L -10 9 Z" fill={color} stroke="#161616" />
      ) : classification === "ELIMINATED" ? (
        <rect
          x="-8"
          y="-8"
          width="16"
          height="16"
          fill={color}
          stroke="#161616"
        />
      ) : classification === "UNCLASSIFIED" ? (
        <path
          d="M 0 -10 L 10 0 L 0 10 L -10 0 Z"
          fill={color}
          stroke="#161616"
        />
      ) : (
        <circle r="8" fill={color} stroke="#161616" />
      )}
    </svg>
  );
}

export function GeographicMap({ report }: { report: GeographicReport }) {
  const { t } = useTranslation(moduleName);
  const [risk, setRisk] = useState(true);
  const [classification, setClassification] = useState(true);
  const [viewport, setViewport] = useState(() => initialViewport(report.foci));
  const [selected, setSelected] = useState<GeographicFocus>();
  const [tileError, setTileError] = useState(false);
  const drag = useRef<{ x: number; y: number }>();
  const size = 256 * 2 ** viewport.zoom;
  const left = viewport.x * size - 400,
    top = viewport.y * size - 240;
  const tiles: { x: number; y: number }[] = [];
  for (
    let y = Math.max(0, Math.floor(top / 256));
    y <= Math.min(2 ** viewport.zoom - 1, Math.floor((top + 480) / 256));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(left / 256));
      x <= Math.min(2 ** viewport.zoom - 1, Math.floor((left + 800) / 256));
      x++
    )
      tiles.push({ x, y });
  const pan = (x: number, y: number) =>
    setViewport((v) => ({
      ...v,
      x: Math.max(0, Math.min(1, v.x + x / size)),
      y: Math.max(0, Math.min(1, v.y + y / size)),
    }));
  const zoom = (delta: number) =>
    setViewport((v) => ({
      ...v,
      zoom: Math.max(2, Math.min(18, v.zoom + delta)),
    }));
  const bounds = report.riskThresholds;
  const ranges = {
    LOW: `1–${bounds[0] - 1}`,
    MEDIUM: `${bounds[0]}–${bounds[1] - 1}`,
    HIGH: `${bounds[1]}–${bounds[2] - 1}`,
    VERY_HIGH: `${bounds[2]}+`,
  };
  return (
    <>
      <div className={styles.controls}>
        <Checkbox
          id="geo-risk-legend"
          labelText={t("geo.riskLegend")}
          checked={risk}
          disabled={risk && !classification}
          onChange={(_, { checked }) => setRisk(checked)}
        />
        <Checkbox
          id="geo-classification-legend"
          labelText={t("geo.classificationLegend")}
          checked={classification}
          disabled={classification && !risk}
          onChange={(_, { checked }) => setClassification(checked)}
        />
      </div>
      <div className={styles.controls}>
        <Button
          size="sm"
          kind="tertiary"
          aria-label={t("geo.zoomIn")}
          onClick={() => zoom(1)}
        >
          +
        </Button>
        <Button
          size="sm"
          kind="tertiary"
          aria-label={t("geo.zoomOut")}
          onClick={() => zoom(-1)}
        >
          −
        </Button>
        <Button
          size="sm"
          kind="tertiary"
          onClick={() => setViewport(initialViewport(report.foci))}
        >
          {t("geo.fit")}
        </Button>
        {(
          [
            ["west", -120, 0],
            ["east", 120, 0],
            ["north", 0, -120],
            ["south", 0, 120],
          ] as const
        ).map(([key, x, y]) => (
          <Button key={key} size="sm" kind="ghost" onClick={() => pan(x, y)}>
            {t(`geo.${key}`)}
          </Button>
        ))}
      </div>
      {tileError && <p role="status">{t("geo.tileError")}</p>}
      <div className={styles.map}>
        <svg
          viewBox="0 0 800 480"
          role="img"
          aria-label={t("geo.mapTitle")}
          onPointerDown={(e) => {
            if (
              e.target === e.currentTarget ||
              (e.target as Element).tagName === "image"
            ) {
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const scale = 800 / e.currentTarget.getBoundingClientRect().width;
            pan(
              (drag.current.x - e.clientX) * scale,
              (drag.current.y - e.clientY) * scale,
            );
            drag.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={() => {
            drag.current = undefined;
          }}
          onPointerCancel={() => {
            drag.current = undefined;
          }}
        >
          <title>{t("geo.mapTitle")}</title>
          {tiles.map((tile) => (
            <image
              key={`${viewport.zoom}/${tile.x}/${tile.y}`}
              x={tile.x * 256 - left}
              y={tile.y * 256 - top}
              width="256"
              height="256"
              href={`https://tile.openstreetmap.org/${viewport.zoom}/${tile.x}/${tile.y}.png`}
              onError={() => setTileError(true)}
            />
          ))}
          {report.foci.map((focus) => {
            if (focus.latitude == null || focus.longitude == null) return null;
            const point = project(focus.latitude, focus.longitude);
            const x = point.x * size - left,
              y = point.y * size - top;
            if (x < -12 || x > 812 || y < -12 || y > 492) return null;
            return (
              <g key={focus.centerId} transform={`translate(${x},${y})`}>
                <title>{`${focus.label}: ${focus.total} · ${t(`geo.classes.${focus.classification}`)} · ${t(`geo.risk.${focus.risk}`)}`}</title>
                <foreignObject x="-12" y="-12" width="24" height="24">
                  <button
                    type="button"
                    className={styles.marker}
                    aria-label={`${focus.label}: ${focus.total}`}
                    onClick={() => setSelected(focus)}
                  >
                    <FocusSymbol
                      classification={
                        classification ? focus.classification : "ACTIVE"
                      }
                      color={risk ? riskColors[focus.risk] : "#da1e28"}
                    />
                  </button>
                </foreignObject>
              </g>
            );
          })}
        </svg>
        <div className={styles.legends}>
          {risk && (
            <div>
              <strong>{t("geo.riskLegend")}</strong>
              {(["VERY_HIGH", "HIGH", "MEDIUM", "LOW"] as const).map((key) => (
                <div className={styles.legendRow} key={key}>
                  <FocusSymbol
                    classification="ACTIVE"
                    color={riskColors[key]}
                  />
                  <span>
                    {t(`geo.risk.${key}`)}: {ranges[key]}
                  </span>
                </div>
              ))}
            </div>
          )}
          {classification && (
            <div>
              <strong>{t("geo.classificationLegend")}</strong>
              {(
                [
                  "ACTIVE",
                  "RESIDUAL",
                  "ELIMINATED",
                  ...(report.foci.some(
                    (f) => f.classification === "UNCLASSIFIED",
                  )
                    ? ["UNCLASSIFIED" as const]
                    : []),
                ] as const
              ).map((key) => (
                <div className={styles.legendRow} key={key}>
                  <FocusSymbol classification={key} color="#da1e28" />
                  <span>{t(`geo.classes.${key}`)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <a
          className={styles.attribution}
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
      {selected && (
        <div role="status">
          <strong>{selected.label}</strong> · {selected.total} ·{" "}
          {t(`geo.classes.${selected.classification}`)} ·{" "}
          {t(`geo.risk.${selected.risk}`)} · {selected.latitude},{" "}
          {selected.longitude}
        </div>
      )}
    </>
  );
}
