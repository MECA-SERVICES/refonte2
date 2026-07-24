export { default as PageHeader } from './PageHeader.svelte';
export { default as DataTable } from './DataTable.svelte';
export { default as Pagination } from './Pagination.svelte';
export { default as StatusBadge } from './StatusBadge.svelte';
export { default as ConfirmDialog } from './ConfirmDialog.svelte';
export { default as CustomerForm } from './CustomerForm.svelte';
export { default as StatCard } from './StatCard.svelte';

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
