/**
 * Vocabulaire et règles d'affichage des pop-ups.
 *
 * Partagé navigateur/serveur, sans accès base : le serveur choisit la pop-up
 * éligible, le navigateur décide quand l'afficher. `$lib/server/popups` garde
 * les accès à la base et réexporte ce qui suit.
 */

/** Portée de l'affichage — voir `matchesPath`. */
export const POPUP_SCOPES = ['all', 'home', 'paths'] as const;
export type PopupScope = (typeof POPUP_SCOPES)[number];

export const POPUP_SCOPE_LABELS: Record<PopupScope, string> = {
	all: 'Tout le site',
	home: "Page d'accueil uniquement",
	paths: 'Pages choisies'
};

/** Préfixe des clés de mémorisation, côté navigateur. */
export const POPUP_STORAGE_PREFIX = 'popup-dismissed:';

/**
 * Décide si une pop-up s'applique à une adresse.
 *
 * `paths` accepte une liste, une entrée par ligne. Un chemin terminé par `*`
 * couvre tout ce qui commence par lui : `/blog*` vise le blog entier, tandis
 * que `/blog` ne vise que la page de liste.
 */
export function matchesPath(
	scope: PopupScope,
	paths: string | null | undefined,
	pathname: string
): boolean {
	if (scope === 'all') return true;
	if (scope === 'home') return pathname === '/';

	const patterns = (paths ?? '')
		.split('\n')
		.map((p) => p.trim())
		.filter(Boolean);

	// Une portée « pages choisies » sans aucune page ne vise rien : mieux vaut
	// ne rien afficher que de tout afficher par accident.
	if (patterns.length === 0) return false;

	return patterns.some((pattern) => {
		if (pattern.endsWith('*')) {
			const prefix = pattern.slice(0, -1);
			return pathname.startsWith(prefix);
		}
		// La barre finale ne distingue pas deux adresses différentes.
		return pathname === pattern || `${pathname}/` === pattern || pathname === `${pattern}/`;
	});
}

/** Éléments de fenêtre de diffusion, tels que portés par la base. */
export type PopupWindow = {
	isActive: boolean;
	startsAt: Date | string | null;
	endsAt: Date | string | null;
};

/**
 * Décide si une pop-up est diffusable à un instant donné.
 *
 * Les bornes sont facultatives : sans date de fin, la diffusion court jusqu'à
 * désactivation.
 */
export function isLive(popup: PopupWindow, now: Date = new Date()): boolean {
	if (!popup.isActive) return false;

	const start = popup.startsAt ? new Date(popup.startsAt) : null;
	const end = popup.endsAt ? new Date(popup.endsAt) : null;

	if (start && now < start) return false;
	if (end && now > end) return false;
	return true;
}

/** Clé de mémorisation d'une pop-up fermée, propre au visiteur. */
export function dismissKey(id: number): string {
	return `${POPUP_STORAGE_PREFIX}${id}`;
}

/**
 * Décide si une pop-up fermée doit rester silencieuse.
 *
 * `stored` est l'horodatage de la fermeture, tel que conservé par le
 * navigateur. Une valeur illisible est ignorée : dans le doute, on réaffiche
 * plutôt que de taire une annonce.
 */
export function isDismissed(
	stored: string | null,
	dismissDays: number,
	now: Date = new Date()
): boolean {
	if (!stored) return false;

	// `0` jour : la fermeture ne vaut que pour la page en cours.
	if (dismissDays <= 0) return false;

	const at = Number(stored);
	if (!Number.isFinite(at)) return false;

	const elapsedDays = (now.getTime() - at) / 86_400_000;
	return elapsedDays < dismissDays;
}
