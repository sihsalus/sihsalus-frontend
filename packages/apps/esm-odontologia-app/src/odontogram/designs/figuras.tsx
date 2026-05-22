/** Common props for all design SVG components */
interface DesignProps {
  strokeColor: string;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  r?: number;
  width?: number;
  height?: number;
}

// Función para renderizar una elipse
export const EllipseDesign = ({ width = 60, height = 30, cx, cy, rx, ry, strokeColor }: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Función para renderizar un círculo
export const CircleDesign = ({ width = 60, height = 30, cx, cy, r, strokeColor }: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const EllipseDesignLeft = ({
  width = 60,
  height = 30,
  cx = 40,
  cy = 15,
  rx = 40,
  ry = 10,
  strokeColor,
}: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <ellipse
      cx={cx} // Centro movido a la derecha (antes 30, ahora 40)
      cy={cy}
      rx={rx} // Elipse más alargada (antes 30, ahora 40)
      ry={ry}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
  </svg>
);

export const EllipseDesignRight = ({
  width = 60,
  height = 30,
  cx = 20,
  cy = 15,
  rx = 40,
  ry = 10,
  strokeColor,
}: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    <ellipse
      cx={cx} // 🔥 Centro movido a la izquierda (antes 30, ahora 20)
      cy={cy}
      rx={rx} // 🔥 Elipse alargada igual que la otra
      ry={ry}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
  </svg>
);

export const EllipseDesignLeftAndRight = ({
  width = 60,
  height = 30,
  cx = 40,
  cy = 15,
  rx = 40,
  ry = 10,
  strokeColor,
}: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {/* Curva izquierda de la primera elipse */}
    <path
      d={`M ${cx - 20} ${cy - ry} A ${rx} ${ry} 0 0 0 ${cx - 20 - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx - 20} ${cy + ry}`}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
    {/* Curva derecha de la segunda elipse */}
    <path
      d={`M ${cx} ${cy - ry} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx} ${cy + ry}`}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
    {/* Líneas horizontales conectoras */}
    <line x1={cx - 20} y1={cy - ry} x2={cx} y2={cy - ry} stroke={strokeColor} strokeWidth="1.5" />
    <line x1={cx - 20} y1={cy + ry} x2={cx} y2={cy + ry} stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const EllipseDesignCenter = ({ width = 20, height = 30, strokeColor }: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {/* Elipse de la izquierda, alineada con EllipseDesignLeft */}
    <ellipse
      cx={-20} // 🔥 Se alinea con la parte derecha de EllipseDesignLeft
      cy={15} // 🔥 Centrada verticalmente
      rx={40} // 🔥 Mismo tamaño de la elipse izquierda
      ry={10}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />

    {/* Elipse de la derecha, alineada con EllipseDesignRight */}
    <ellipse
      cx={40} // 🔥 Se alinea con la parte derecha de EllipseDesignLeft
      cy={15} // 🔥 Centrada verticalmente
      rx={40} // 🔥 Mismo tamaño de la elipse izquierda
      ry={10}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
  </svg>
);

export const EllipseDesignLeftCenter = ({ width = 20, height = 30, strokeColor }: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {/* Elipse de la izquierda, alineada con EllipseDesignLeft */}
    <ellipse
      cx={-20} // 🔥 Se alinea con la parte derecha de EllipseDesignLeft
      cy={15} // 🔥 Centrada verticalmente
      rx={40} // 🔥 Mismo tamaño de la elipse izquierda
      ry={10}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
  </svg>
);

export const EllipseDesignRightCenter = ({ width = 20, height = 30, strokeColor }: DesignProps) => (
  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
    {/* Elipse de la derecha, alineada con EllipseDesignRight */}
    <ellipse
      cx={40} // 🔥 Se alinea con la parte derecha de EllipseDesignLeft
      cy={15} // 🔥 Centrada verticalmente
      rx={40} // 🔥 Mismo tamaño de la elipse izquierda
      ry={10}
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
    />
  </svg>
);

// Diseños para hallazgo 1
export const Finding1Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Cuadrado pequeño en el centro */}
    <rect x="25" y="5" width="10" height="10" fill="none" stroke={strokeColor} strokeWidth="1.5" />
    {/* Cruz dentro del cuadrado */}
    <line x1="25" y1="10" x2="35" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    <line x1="30" y1="5" x2="30" y2="15" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea que va hacia la derecha */}
    <line x1="35" y1="10" x2="60" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding1Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Cuadrado pequeño en el centro */}
    <rect x="25" y="5" width="10" height="10" fill="none" stroke={strokeColor} strokeWidth="1.5" />
    {/* Cruz dentro del cuadrado */}
    <line x1="25" y1="10" x2="35" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    <line x1="30" y1="5" x2="30" y2="15" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea que va hacia la izquierda */}
    <line x1="0" y1="10" x2="25" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding1Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Línea horizontal de extremo a extremo */}
    <line x1="0" y1="10" x2="60" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseños para espacios entre hallazgo 1 (20x20)
export const Finding1Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Cuadrado más grande en el centro */}
    <rect x="5" y="5" width="10" height="10" fill="none" stroke={strokeColor} strokeWidth="1.5" />
    {/* Cruz dentro del cuadrado */}
    <line x1="5" y1="10" x2="15" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    <line x1="10" y1="5" x2="10" y2="15" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea que va hacia la derecha (más corta) */}
    <line x1="15" y1="10" x2="20" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding1Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Cuadrado más grande en el centro */}
    <rect x="5" y="5" width="10" height="10" fill="none" stroke={strokeColor} strokeWidth="1.5" />
    {/* Cruz dentro del cuadrado */}
    <line x1="5" y1="10" x2="15" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    <line x1="10" y1="5" x2="10" y2="15" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea que va hacia la izquierda (más corta) */}
    <line x1="0" y1="10" x2="5" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding1Design6 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Línea horizontal de extremo a extremo (manteniendo margen) */}
    <line x1="0" y1="10" x2="20" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño grande (60x20) con tres picos
export const Finding2Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Patrón de tres picos */}
    <path d="M0 15 L10 5 L20 15 L30 5 L40 15 L50 5 L60 15" fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño pequeño (20x20) con un pico
export const Finding2Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Un solo pico */}
    <path d="M0 15 L10 5 L20 15" fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño de flecha hacia abajo
export const Finding24Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    <path
      d="M25 2 L25 12 L20 12 L30 18 L40 12 L35 12 L35 2 Z"
      fill={strokeColor}
      stroke={strokeColor}
      strokeWidth="1"
    />
  </svg>
);

// Diseño de flecha hacia arriba (inversión vertical de Finding24Design1)
export const Finding24Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    <path d="M25 18 L25 8 L20 8 L30 2 L40 8 L35 8 L35 18 Z" fill={strokeColor} stroke={strokeColor} strokeWidth="1" />
  </svg>
);

// Diseño de flecha hacia arriba (para dientes superiores)
export const Finding25Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    <path d="M25 18 L25 8 L20 8 L30 2 L40 8 L35 8 L35 18 Z" fill={strokeColor} stroke={strokeColor} strokeWidth="1" />
  </svg>
);

// Diseño de flecha hacia abajo (para dientes inferiores) - reutiliza Finding24Design1
export const Finding25Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    <path
      d="M25 2 L25 12 L20 12 L30 18 L40 12 L35 12 L35 2 Z"
      fill={strokeColor}
      stroke={strokeColor}
      strokeWidth="1"
    />
  </svg>
);

// Componente simplificado para renderizar paréntesis )( con solo el parámetro strokeColor personalizable
export const Finding6Design1 = ({ strokeColor = 'blue' }) => {
  // Valores fijos
  const width = 20;
  const height = 60;
  const strokeWidth = 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    >
      {/* Paréntesis que se cierra ) - más curvo */}
      <path d="M2 10 Q10 30 2 50" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />

      {/* Paréntesis que se abre ( - más curvo */}
      <path d="M18 10 Q10 30 18 50" fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
    </svg>
  );
};

export const Finding12Design1 = ({ strokeColor = 'blue' }) => {
  // Valores fijos
  const width = 60;
  const height = 30;
  const strokeWidth = 1.8;

  // Posición del círculo en el centro
  const cx = width / 2; // 30
  const cy = height / 2; // 15
  const radius = 12; // Tamaño del círculo

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Círculo centrado */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} />
    </svg>
  );
};

// Componente para renderizar un triángulo en el centro del SVG
export const Finding21Design1 = ({ strokeColor = 'blue' }) => {
  // Valores fijos
  const width = 60;
  const height = 30;
  const strokeWidth = 1.8;

  // Centro del SVG
  const centerX = width / 2; // 30
  const centerY = height / 2; // 15

  // Tamaño del triángulo
  const size = 15;

  // Calcular los puntos del triángulo equilátero centrado
  const points = [
    // Punto superior
    `${centerX},${centerY - size}`,
    // Punto inferior izquierdo
    `${centerX - size * 0.866},${centerY + size / 2}`,
    // Punto inferior derecho
    `${centerX + size * 0.866},${centerY + size / 2}`,
  ].join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Triángulo centrado */}
      <polygon points={points} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </svg>
  );
};

// Diseños para hallazgo 30 (60x20)
export const Finding30Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Línea horizontal desde la izquierda hacia el 90% del ancho */}
    <line x1="0" y1="10" x2="54" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea vertical que baja desde el extremo derecho */}
    <line x1="54" y1="10" x2="54" y2="18" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding30Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Línea horizontal de extremo a extremo */}
    <line x1="0" y1="10" x2="60" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding30Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Línea horizontal desde la derecha hacia el 10% del ancho desde la izquierda */}
    <line x1="60" y1="10" x2="6" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea vertical que baja desde el extremo izquierdo */}
    <line x1="6" y1="10" x2="6" y2="18" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseños para espacios entre hallazgo 30 (20x20)
export const Finding30Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Versión más pequeña - Línea horizontal desde la izquierda hacia el 90% del ancho */}
    <line x1="0" y1="10" x2="18" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea vertical que baja desde el extremo derecho */}
    <line x1="18" y1="10" x2="18" y2="18" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding30Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Línea horizontal de extremo a extremo */}
    <line x1="0" y1="10" x2="20" y2="10" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding30Design6 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Versión más pequeña - Línea horizontal desde la derecha hacia el 10% del ancho desde la izquierda */}
    <line x1="20" y1="10" x2="2" y2="10" stroke={strokeColor} strokeWidth="1.5" />
    {/* Línea vertical que baja desde el extremo izquierdo */}
    <line x1="2" y1="10" x2="2" y2="18" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño de dos líneas horizontales para tamaño 60x20
export const TwoHorizontalLines60x20 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Primera línea horizontal (superior) */}
    <line x1="0" y1="7" x2="60" y2="7" stroke={strokeColor} strokeWidth="1.5" />

    {/* Segunda línea horizontal (inferior) */}
    <line x1="0" y1="13" x2="60" y2="13" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño de dos líneas horizontales para tamaño 20x20
export const TwoHorizontalLines20x20 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20">
    {/* Primera línea horizontal (superior) */}
    <line x1="0" y1="7" x2="20" y2="7" stroke={strokeColor} strokeWidth="1.5" />

    {/* Segunda línea horizontal (inferior) */}
    <line x1="0" y1="13" x2="20" y2="13" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

// Diseño de un cuadrado de 60x60 pegado a la parte inferior del espacio 60x120
export const Finding3Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cuadrado ajustado para que el borde de 2px sea completamente visible */}
    <rect x="1.5" y="61.5" width="57" height="57" fill="none" stroke={strokeColor} strokeWidth="2.5" />
  </svg>
);

export const Finding4Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cuadrado ajustado para quedar pegado al Finding3Design1 */}
    <rect x="3.5" y="63.5" width="53" height="53" fill="none" stroke={strokeColor} strokeWidth="2.5" />
  </svg>
);

export const Finding8Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cuadrado centrado en la parte inferior (30x30) */}
    <rect x="15" y="75" width="30" height="30" fill="none" stroke={strokeColor} strokeWidth="3" />

    {/* Línea vertical desde el centro superior del cuadrado hacia arriba */}
    <line x1="30" y1="75" x2="30" y2="10" stroke={strokeColor} strokeWidth="3" />
  </svg>
);
// Diseño 2: Cuadrado con dos líneas en ángulo que parten del centro superior
export const Finding8Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cuadrado centrado en la parte inferior (30x30) */}
    <rect x="15" y="75" width="30" height="30" fill="none" stroke={strokeColor} strokeWidth="3" />

    {/* Línea izquierda con ángulo que parte del centro superior del cuadrado */}
    <line x1="30" y1="75" x2="15" y2="10" stroke={strokeColor} strokeWidth="3" />

    {/* Línea derecha con ángulo que parte del centro superior del cuadrado */}
    <line x1="30" y1="75" x2="45" y2="10" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

// Diseño 3: Cuadrado con línea vertical y dos líneas en ángulo, todas partiendo del centro superior
export const Finding8Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cuadrado centrado en la parte inferior (30x30) */}
    <rect x="15" y="75" width="30" height="30" fill="none" stroke={strokeColor} strokeWidth="3" />

    {/* Línea vertical desde el centro superior del cuadrado hacia arriba */}
    <line x1="30" y1="75" x2="30" y2="10" stroke={strokeColor} strokeWidth="3" />

    {/* Línea izquierda con ángulo que parte del centro superior del cuadrado */}
    <line x1="30" y1="75" x2="15" y2="10" stroke={strokeColor} strokeWidth="3" />

    {/* Línea derecha con ángulo que parte del centro superior del cuadrado */}
    <line x1="30" y1="75" x2="45" y2="10" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

// Diseño 1: Flecha curva indicando giro hacia la derecha
export const Finding13Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Arco curvo principal */}
    <path d="M 10,15 Q 30,-10 50,15" fill="none" stroke={strokeColor} strokeWidth="3" />
    {/* Punta de flecha rotada para seguir la curva - más rotación */}
    <line x1="50" y1="15" x2="49" y2="7" stroke={strokeColor} strokeWidth="3" />
    {/* Punta de flecha - lado izquierdo - más rotación */}
    <line x1="50" y1="15" x2="42" y2="16" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

// Diseño 2: Flecha curva indicando giro hacia la izquierda
export const Finding13Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Arco curvo principal */}
    <path d="M 50,15 Q 30,-10 10,15" fill="none" stroke={strokeColor} strokeWidth="3" />
    {/* Punta de flecha rotada para seguir la curva - más rotación */}
    <line x1="10" y1="15" x2="11" y2="7" stroke={strokeColor} strokeWidth="3" />
    {/* Punta de flecha - lado derecho - más rotación */}
    <line x1="10" y1="15" x2="18" y2="16" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

// Diseño 2: Una X grande en un espacio de 60x120
export const Finding20Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea diagonal de arriba izquierda a abajo derecha */}
    <line x1="10" y1="10" x2="50" y2="110" stroke={strokeColor} strokeWidth="3" />
    {/* Línea diagonal de arriba derecha a abajo izquierda */}
    <line x1="50" y1="10" x2="10" y2="110" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding23Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea principal en zigzag con 4 segmentos */}
    <path
      d="M 30,10 L 45,33 L 15,56 L 45,79 L 15,102"
      fill="none"
      stroke={strokeColor}
      strokeWidth="3"
      strokeLinejoin="round"
      strokeLinecap="round"
    />

    {/* Punta de flecha */}
    <path d="M 15,102 L 22,90 L 26,100 Z" fill={strokeColor} stroke={strokeColor} strokeWidth="1" />
  </svg>
);

export const Finding38Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea recta vertical centrada que termina 30 unidades antes de la base */}
    <line x1="28" y1="0" x2="28" y2="90" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Finding7Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea horizontal a 30 unidades desde la base, tocando los bordes laterales */}
    <line x1="0" y1="90" x2="60" y2="90" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding7Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="60" viewBox="0 0 60 60">
    {/* Línea horizontal a 30 unidades desde la base, tocando los bordes laterales */}
    <line x1="0" y1="30" x2="60" y2="30" stroke={strokeColor} strokeWidth="3" strokeLinecap="butt" />
  </svg>
);

export const Finding26Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={{ userSelect: 'none' }}>
    {/* Círculo que ocupa todo el espacio */}
    <circle cx="10" cy="10" r="9" stroke={strokeColor} strokeWidth="1" fill="none" />
    {/* Letra S grande en el centro - no seleccionable */}
    <text
      x="10"
      y="14"
      fontSize="12"
      fontWeight="bold"
      textAnchor="middle"
      fill={strokeColor}
      fontFamily="Arial, sans-serif"
    >
      S
    </text>
  </svg>
);

export const Finding39Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="20" height="20" viewBox="0 0 20 20" style={{ userSelect: 'none' }}>
    {/* Curva simple que empieza en la esquina superior izquierda y termina exactamente en el punto (18,18) */}
    <path d="M0,2 Q10,0 18,18" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />

    {/* Curva simple que empieza en la esquina superior derecha y termina exactamente en el punto (2,18) */}
    <path d="M20,2 Q10,0 2,18" fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />

    {/* Borde izquierdo inferior (2 unidades dentro del borde) */}
    <path
      d="M2,13 L2,18 L7,18"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Borde derecho inferior (2 unidades dentro del borde) */}
    <path
      d="M13,18 L18,18 L18,13"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const Finding39Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Curva que empieza a 3/4 partes hacia la derecha */}
    <path d="M45,18 Q50,10 60,2" fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding39Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="20" viewBox="0 0 60 20">
    {/* Curva que empieza a 3/4 partes hacia la izquierda */}
    <path d="M15,18 Q10,10 0,2" fill="none" stroke={strokeColor} strokeWidth="1.5" />
  </svg>
);

export const Finding28Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea recta vertical centrada que termina 30 unidades antes de la base */}
    <line x1="32" y1="0" x2="32" y2="65" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Finding37Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea superior horizontal del cuadrado — posicionada en y=62 (no y=60) para
       que el grosor de stroke 4 (extiende ±2) quede totalmente dentro del cuerpo
       y no desborde 2px hacia la raíz. */}
    <line x1="0" y1="62" x2="60" y2="62" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding37Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea inferior horizontal del cuadrado (cubre todo el ancho) */}
    <line x1="0" y1="118" x2="60" y2="118" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding37Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical izquierda del cuadrado */}
    <line x1="2" y1="60" x2="2" y2="120" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding37Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical derecha del cuadrado */}
    <line x1="58" y1="60" x2="58" y2="120" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding37Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea superior horizontal del cuadrado (cubre todo el ancho) */}
    <line x1="15" y1="90" x2="45" y2="90" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding36Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Cruz en el medio del cuadrado inferior */}
    {/* Línea horizontal de la cruz */}
    <line x1="15" y1="90" x2="45" y2="90" stroke={strokeColor} strokeWidth="4" />
    {/* Línea vertical de la cruz */}
    <line x1="30" y1="75" x2="30" y2="105" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding36Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea horizontal en el medio del cuadrado inferior */}
    <line x1="15" y1="90" x2="45" y2="90" stroke={strokeColor} strokeWidth="4" />
  </svg>
);

export const Finding10Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea superior horizontal, alejada 8 unidades del borde superior del cuadrado */}
    <line x1="0" y1="68" x2="60" y2="68" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea inferior horizontal, alejada 8 unidades del borde inferior del cuadrado */}
    <line x1="0" y1="112" x2="60" y2="112" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical izquierda, alejada 8 unidades del borde izquierdo del cuadrado */}
    <line x1="8" y1="60" x2="8" y2="120" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical derecha, alejada 8 unidades del borde derecho del cuadrado */}
    <line x1="52" y1="60" x2="52" y2="120" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea superior horizontal, alejada 8 unidades del borde superior del cuadrado */}
    <line x1="0" y1="30" x2="40" y2="105" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design6 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical izquierda, alejada 8 unidades del borde izquierdo del cuadrado */}
    <line x1="20" y1="105" x2="60" y2="30" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design7 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea vertical derecha, alejada 8 unidades del borde derecho del cuadrado */}
    <line x1="0" y1="90" x2="30" y2="120" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

export const Finding10Design8 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    {/* Línea inferior horizontal, alejada 8 unidades del borde inferior del cuadrado */}
    <line x1="60" y1="90" x2="30" y2="120" stroke={strokeColor} strokeWidth="3" />
  </svg>
);

// Finding5 Designs - escala corregida para ocupar el espacio de 60x60
export const Finding5Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 60,60 45,90 15,90" fill={strokeColor} />
  </svg>
);

export const Finding5Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 15,90 0,120" fill={strokeColor} />
  </svg>
);

export const Finding5Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="60,60 60,120 45,90" fill={strokeColor} />
  </svg>
);

export const Finding5Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,120 15,90 45,90 60,120" fill={strokeColor} />
  </svg>
);

export const Finding5Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 60,60 45,75 15,75" fill={strokeColor} />
  </svg>
);

export const Finding5Design6 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,105 45,105 60,120 0,120" fill={strokeColor} />
  </svg>
);

export const Finding5Design7 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 15,75 15,105 0,120" fill={strokeColor} />
  </svg>
);

export const Finding5Design8 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="45,75 60,60 60,120 45,105" fill={strokeColor} />
  </svg>
);

export const Finding5Design9 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,75 45,75 45,90 15,90" fill={strokeColor} />
  </svg>
);

export const Finding5Design10 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,90 45,90 45,105 15,105" fill={strokeColor} />
  </svg>
);

export const Finding5Design11 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,75 30,75 30,90 15,90" fill={strokeColor} />
  </svg>
);

export const Finding5Design12 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="30,75 45,75 45,90 30,90" fill={strokeColor} />
  </svg>
);

export const Finding5Design13 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,90 30,90 30,105 15,105" fill={strokeColor} />
  </svg>
);

export const Finding5Design14 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="30,90 45,90 45,105 30,105" fill={strokeColor} />
  </svg>
);

export const Finding27Design9 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,75 45,75 45,105 15,105" fill={strokeColor} />
  </svg>
);

// Finding5 Designs - escala corregida para ocupar el espacio de 60x60
export const Finding35Design1 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 60,60 45,90 15,90" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design2 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 15,90 0,120" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design3 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="60,60 60,120 45,90" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design4 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,120 15,90 45,90 60,120" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design5 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 60,60 45,75 15,75" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design6 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,105 45,105 60,120 0,120" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design7 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="0,60 15,75 15,105 0,120" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design8 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="45,75 60,60 60,120 45,105" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design9 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,75 45,75 45,90 15,90" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design10 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,90 45,90 45,105 15,105" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design11 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,75 30,75 30,90 15,90" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design12 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="30,75 45,75 45,90 30,90" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design13 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="15,90 30,90 30,105 15,105" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
export const Finding35Design14 = ({ strokeColor }: DesignProps) => (
  <svg width="60" height="120" viewBox="0 0 60 120">
    <polygon points="30,90 45,90 45,105 30,105" fill="none" stroke={strokeColor} strokeWidth="4" />
  </svg>
);
