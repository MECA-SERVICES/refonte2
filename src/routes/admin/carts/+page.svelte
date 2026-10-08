<script lang="ts">
	import { PageHeader, DataTable, Pagination, StatCard } from '$lib/components/admin';
	import { CartSolid, ChartLineUpOutline, CashOutline } from 'flowbite-svelte-icons';
	import { formatPrice } from '$lib/money';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type CartRow = (typeof data.rows)[number];
	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const percentFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

	const s = $derived(data.stats);
</script>

<svelte:head><title>Paniers · Administration</title></svelte:head>

<PageHeader
	title="Paniers"
	subtitle="{data.total} panier{data.total > 1 ? 's' : ''}"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Paniers' }]}
/>

<!-- Indicateurs sur 30 jours glissants, comme la page Paniers de PrestaShop. -->
<div class="mb-6 grid gap-4 sm:grid-cols-3">
	<StatCard
		label="Taux de transformation"
		value={s.conversionRate === null ? '—' : `${percentFmt.format(s.conversionRate)} %`}
		icon={ChartLineUpOutline}
		hint="Commandes / paniers créés · {s.days} jours"
	/>
	<StatCard
		label="Paniers abandonnés"
		value={s.abandonedCarts}
		icon={CartSolid}
		hint="Garnis, inactifs depuis plus de {s.abandonedAfterHours} h · {s.days} jours"
	/>
	<StatCard
		label="Panier moyen"
		value={s.averageOrder === null ? '—' : formatPrice(s.averageOrder)}
		icon={CashOutline}
		hint="Commandes réglées, TTC · {s.days} jours"
	/>
</div>

{#snippet idCell(row: CartRow)}
	<span class="text-gray-500">{row.id}</span>
{/snippet}

{#snippet customerCell(row: CartRow)}
	<span class="font-medium text-gray-900 dark:text-white">
		{row.customerFirstName}
		{row.customerLastName}
	</span>
	<span class="block text-xs text-gray-500 dark:text-gray-400">{row.customerEmail}</span>
{/snippet}

{#snippet activityCell(row: CartRow)}
	<span class="text-gray-600 dark:text-gray-300">
		{dateFmt.format(new Date(row.lastActivityAt))}
	</span>
{/snippet}

<DataTable
	rows={data.rows}
	columns={[
		{ key: 'id', label: 'ID', cell: idCell },
		{ key: 'customer', label: 'Client', cell: customerCell },
		{ key: 'itemCount', label: 'Articles' },
		{ key: 'activity', label: 'Dernière activité', cell: activityCell }
	]}
	emptyMessage="Aucun panier."
	rowHref={(row) => `/admin/carts/${row.id}`}
/>

<Pagination
	page={data.page}
	pageCount={data.pageCount}
	total={data.total}
	hrefFor={(p) => `/admin/carts?page=${p}`}
/>
