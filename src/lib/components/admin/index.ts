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
 * Construit un lien de pagination qui conserve les filtres et le tri courants.
 * Utilisé par toutes les pages liste de l'admin.
 */
export function listPageHref(
	basePath: string,
	state: {
		filters: Record<string, string>;
		sort: string;
		dir: string;
		extra?: Record<string, string>;
	},
	page: number
): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(state.extra ?? {})) {
		if (value) search.set(key, value);
	}
	for (const [key, value] of Object.entries(state.filters)) {
		if (value) search.set(`f_${key}`, value);
	}
	if (state.sort) {
		search.set('sort', state.sort);
		search.set('dir', state.dir);
	}
	search.set('page', String(page));
	return `${basePath}?${search.toString()}`;
}

type BadgeColor = 'gray' | 'green' | 'yellow' | 'red' | 'blue' | 'indigo' | 'purple';

/** Libellés + couleurs partagés pour les badges (type/statut/rôle). */
export const CUSTOMER_TYPE_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	particulier: { label: 'Particulier', color: 'blue' },
	entreprise: { label: 'Entreprise', color: 'indigo' },
	collectivite: { label: 'Collectivité', color: 'purple' }
};

export const CUSTOMER_STATUS_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	pending: { label: 'En attente', color: 'yellow' },
	validated: { label: 'Validé', color: 'green' },
	rejected: { label: 'Rejeté', color: 'red' }
};

export const ROLE_BADGES: Record<string, { label: string; color: BadgeColor }> = {
	admin: { label: 'Administrateur', color: 'green' },
	customer: { label: 'Client', color: 'gray' }
};
