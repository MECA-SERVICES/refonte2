/** Une vue du carrousel d'accueil. */
export type Slide = {
	title: string;
	text?: string;
	/** Petit libellé au-dessus du titre (« 30 ans d'expérience »…). */
	eyebrow?: string;
	cta: string;
	href: string;
	/** Visuel de la vue ; à défaut, un bloc d'attente est affiché. */
	image?: string | null;
	/** Description du visuel attendu, affichée dans le bloc d'attente. */
	imageLabel: string;
	/** Dimension conseillée du visuel, ex. « 1200 × 640 ». */
	imageHint?: string;
};
