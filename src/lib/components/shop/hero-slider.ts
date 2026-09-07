/** Une vue du carrousel d'accueil. */
export type Slide = {
	/** Destination au clic sur le visuel. */
	href: string;
	/** Visuel de la vue ; à défaut, un bloc d'attente est affiché. */
	image?: string | null;
	/** Description du visuel attendu, affichée dans le bloc d'attente. */
	imageLabel: string;
	/** Dimension conseillée du visuel, ex. « 1200 × 400 ». */
	imageHint?: string;
};
