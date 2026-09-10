import type { Pathname } from '$app/types';

export { default as PageHeader } from './PageHeader.svelte';
export { default as DataTable } from './DataTable.svelte';
export { default as FilterableTable } from './FilterableTable.svelte';
export { default as Pagination } from './Pagination.svelte';
export { default as StatusBadge } from './StatusBadge.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as CustomerForm } from './CustomerForm.svelte';
export { default as BrandForm } from './BrandForm.svelte';
export { default as CategoryForm } from './CategoryForm.svelte';
export { default as ProductForm } from './ProductForm.svelte';
export { default as TaxRuleForm } from './TaxRuleForm.svelte';
export { default as OrderStateForm } from './OrderStateForm.svelte';
export { default as StatCard } from './StatCard.svelte';
export { default as ActiveBadge } from './ActiveBadge.svelte';
export { default as StateBadge } from './StateBadge.svelte';
export { default as Thumbnail } from './Thumbnail.svelte';
export { default as TabPanel } from './TabPanel.svelte';
export { default as ProductMediaGrid } from './ProductMediaGrid.svelte';
export { default as CategoryPicker } from './CategoryPicker.svelte';

/**
 * Assemble une query string à partir de paires clé/valeur, en ignorant les
 * valeurs vides.
 *
 * Construite à la main plutôt qu'avec `URLSearchParams` : la valeur est
 * consommée immédiatement, jamais relue de façon réactive, et l'usage de
 * `URLSearchParams` dans un composant Svelte est signalé comme source de bugs
 * de réactivité.
 */
function toQueryString(pairs: [string, string | number | null | undefined][]): string {
	return pairs
		.filter(([, value]) => value !== null && value !== undefined && String(value) !== '')
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
		.join('&');
}

/** Concatène un chemin et une query string, en omettant le `?` si elle est vide. */
export function withQuery(basePath: Pathname, query: string): Pathname {
	return (query ? `${basePath}?${query}` : basePath) as Pathname;
}

/**
 * Construit un lien de pagination qui conserve les filtres et le tri courants.
 * Utilisé par toutes les pages liste de l'admin.
 */
export function listPageHref(
	basePath: Pathname,
	state: {
		filters: Record<string, string>;
		sort: string;
		dir: string;
		extra?: Record<string, string>;
	},
	page: number
): Pathname {
	const pairs: [string, string | number][] = [];
	for (const [key, value] of Object.entries(state.extra ?? {})) pairs.push([key, value]);
	for (const [key, value] of Object.entries(state.filters)) pairs.push([`f_${key}`, value]);
	if (state.sort) {
		pairs.push(['sort', state.sort]);
		pairs.push(['dir', state.dir]);
	}
	pairs.push(['page', page]);
	return withQuery(basePath, toQueryString(pairs));
}

/**
 * Construit un lien de liste filtré sur un seul critère, en repartant de zéro.
 * Utilisé par les raccourcis de filtrage (tuiles de statistiques, recherche).
 */
export function listFilterHref(
	basePath: Pathname,
	pairs: [string, string | number | null | undefined][]
): Pathname {
	return withQuery(basePath, toQueryString(pairs));
}

type BadgeColor = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'indigo' | 'purple';

/** Libellés + couleurs partagés pour les badges (type/statut/rôle). */
/**
 * Libellés des types de compte (CDC 08).
 *
 * Les valeurs anglaises viennent de la reprise PrestaShop et coexistent avec
 * celles du cahier des charges : les deux sont traduites tant que la migration
 * des données n'a pas harmonisé la colonne.
 */
export const CUSTOMER_TYPE_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	particulier: { label: 'Particulier', color: 'blue' },
	individual: { label: 'Particulier', color: 'blue' },
	pro: { label: 'Professionnel', color: 'indigo' },
	professional: { label: 'Professionnel', color: 'indigo' },
	entreprise: { label: 'Entreprise', color: 'indigo' },
	collectivite: { label: 'Collectivité', color: 'purple' }
};

/** Statuts de validation du compte (CDC 08, R1-R2). */
export const CUSTOMER_STATUS_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	pending: { label: 'En attente', color: 'yellow' },
	validated: { label: 'Validé', color: 'green' },
	active: { label: 'Validé', color: 'green' },
	rejected: { label: 'Rejeté', color: 'red' },
	inactive: { label: 'Inactif', color: 'gray' }
};

export const ROLE_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	admin: { label: 'Administrateur', color: 'green' },
	customer: { label: 'Client', color: 'gray' }
};
