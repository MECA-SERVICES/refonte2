<script lang="ts">
	import { UsersSolid, ClockSolid, ArchiveSolid, TagSolid, CartSolid } from 'flowbite-svelte-icons';
	import { PageHeader, StatCard } from '$lib/components/admin';
	import StatsPanel from '$lib/components/admin/StatsPanel.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Tableau de bord · Administration</title></svelte:head>

<PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre boutique" />

<!-- 5 colonnes seulement sur grand écran : en dessous, les grands nombres
     (« 1 053 958 ») passent sous l'icône. -->
<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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
		href="/admin/customers/validations"
	/>
	<StatCard
		label="Produits"
		value={data.stats.products}
		icon={ArchiveSolid}
		href="/admin/products"
	/>
	<StatCard label="Marques" value={data.stats.brands} icon={TagSolid} href="/admin/brands" />
</div>

<!-- Statistiques, rapatriées de l'ancienne page « Statistiques » (demande 13.1). -->
<h2 class="mb-4 text-lg font-semibold text-gray-900">Statistiques</h2>
<StatsPanel {data} />
