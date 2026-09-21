<script lang="ts">
	import Breadcrumb from '$lib/components/shop/Breadcrumb.svelte';
	import Heading from '$lib/components/shop/Heading.svelte';
	import Panel from '$lib/components/shop/Panel.svelte';
	import { REPAIR_STATUS_LABELS, REPAIR_TYPE_LABELS } from '$lib/repairs';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });
</script>

<svelte:head>
	<title>Mes réparations — MS Shop</title>
</svelte:head>

<Breadcrumb items={[{ label: 'Mon compte', href: '/compte' }, { label: 'Mes réparations' }]} />

<Heading size="page">Mes réparations</Heading>

{#if data.repairs.length === 0}
	<Panel class="mt-5 p-8 text-center" tone="subtle">
		<p class="font-display text-base font-bold text-shop-ink">Aucune réparation en cours.</p>
		<p class="mt-1 text-sm text-shop-muted">Vos interventions à l'atelier apparaîtront ici.</p>
	</Panel>
{:else}
	<ul class="mt-5 space-y-3">
		{#each data.repairs as repair (repair.id)}
			<li class="border-[1.5px] border-shop-border bg-white p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="font-display text-base font-bold text-shop-ink">
							{[repair.machineBrand, repair.machineModel].filter(Boolean).join(' ') || 'Machine'}
						</p>
						<p class="mt-0.5 text-xs text-shop-muted">
							Ordre {repair.reference} · déposé le {date.format(new Date(repair.createdAt))}
						</p>
					</div>

					<div class="text-right">
						<span
							class="inline-block bg-shop-subtle px-2.5 py-1 font-display text-[11px] font-bold tracking-wide text-shop-ink uppercase"
						>
							{REPAIR_STATUS_LABELS[repair.status]}
						</span>
						{#if repair.orderType === 'warranty'}
							<p class="mt-1 text-xs text-shop-muted">{REPAIR_TYPE_LABELS.warranty}</p>
						{:else if Number(repair.totalTtc) > 0}
							<p class="mt-1 text-sm font-bold text-shop-ink">
								{eur.format(Number(repair.totalTtc))}
							</p>
						{/if}
					</div>
				</div>

				{#if repair.deliveredAt}
					<p class="mt-2 text-xs text-shop-muted">
						Machine restituée le {date.format(new Date(repair.deliveredAt))}
					</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
