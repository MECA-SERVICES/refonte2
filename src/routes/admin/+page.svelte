<script lang="ts">
	import { UsersSolid, ClockSolid, ArchiveSolid, TagSolid, CartSolid } from 'flowbite-svelte-icons';
	import { PageHeader, StatCard } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Tableau de bord · Administration</title></svelte:head>

<PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre boutique" />

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	<StatCard label="Commandes" value={data.stats.orders} icon={CartSolid} href="/admin/orders" />
	<StatCard
		label="Clients"
		value={data.stats.customers}
		icon={UsersSolid}
		href="/admin/customers"
	/>
	<StatCard
		label="Comptes en attente"
		value={data.stats.pending}
		icon={ClockSolid}
		href="/admin/customers?status=pending"
	/>
	<StatCard
		label="Produits"
		value={data.stats.products}
		icon={ArchiveSolid}
		href="/admin/products"
	/>
	<StatCard label="Marques" value={data.stats.brands} icon={TagSolid} href="/admin/brands" />
</div>
