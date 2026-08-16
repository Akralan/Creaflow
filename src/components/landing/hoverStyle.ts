import type { CSSProperties, MouseEvent } from "react";

/**
 * Reproduit le pattern `style-hover` du design source (attribut custom de l'outil de design,
 * pas du vrai HTML) en suivant le même mécanisme que src/components/ui/Button.tsx :
 * applique les styles au survol et les retire à la sortie via `e.currentTarget.style`.
 */
export function hoverHandlers(baseStyle: CSSProperties, hoverStyle: CSSProperties) {
  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      Object.assign(e.currentTarget.style, hoverStyle);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      Object.assign(e.currentTarget.style, baseStyle);
    },
  };
}
