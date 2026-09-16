<script lang="ts">
	import type { ApexOptions } from 'apexcharts';
	import { Chart } from '@flowbite-svelte-plugins/chart';
	import { Button, Card } from 'flowbite-svelte';
	import { ArrowUpOutline, ArrowDownOutline } from 'flowbite-svelte-icons';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const eur = new Intl.NumberFormat('fr-FR', {
		style: 'currency',
		currency: 'EUR',
		maximumFractionDigits: 0
	});
	const eurPrecise = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
	const num = new Intl.NumberFormat('fr-FR');
	const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

	const PERIOD_LABELS: Record<number, string> = {
		7: '7 jours',
		30: '30 jours',
		90: '90 jours',
		365: '12 mois'
	};

	/** Couleur de la charte, reprise sur les graphiques. */
	const BLUE = '#314192';

	/** Courbe du chiffre d'affaires. */
	const revenueChart = $derived<ApexOptions>({
		chart: {
			height: 320,
			type: 'area',
			fontFamily: 'inherit',
			toolbar: { show: false },
			dropShadow: { enabled: false }
		},
		series: [
			{
				name: 'Chiffre d’affaires',
				data: data.series.map((point) => Math.round(point.revenue))
			}
		],
		xaxis: {
			categories: data.series.map((point) => dayFmt.format(new Date(point.day))),
			labels: {
				// Au-delà d'un mois, une étiquette par jour devient illisible :
				// on n'en garde qu'une sur dix.
				rotate: 0,
				hideOverlappingLabels: true,
				style: { fontSize: '11px' }
			},
			axisBorder: { show: false },
			axisTicks: { show: false },
			tooltip: { enabled: false }
		},
		yaxis: {
			labels: {
				formatter: (value: number) => eur.format(value),
				style: { fontSize: '11px' }
			}
		},
		colors: [BLUE],
		fill: {
			type: 'gradient',
			gradient: { opacityFrom: 0.4, opacityTo: 0, shade: BLUE, gradientToColors: [BLUE] }
		},
		stroke: { curve: 'smooth', width: 2 },
		dataLabels: { enabled: false },
		grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
		tooltip: { y: { formatter: (value: number) => eurPrecise.format(value) } }
	});

	/** Répartition des commandes par état. */
	const statesChart = $derived<ApexOptions>({
		chart: { height: 300, type: 'donut', fontFamily: 'inherit', toolbar: { show: false } },
		series: data.states.map((state) => state.total),
		labels: data.states.map((state) => state.label),
		// Les couleurs viennent des états eux-mêmes : l'opérateur retrouve celles
		// qu'il voit dans la liste des commandes.
		colors: data.states.map((state) => state.color ?? '#9ca3af'),
		legend: { position: 'bottom', fontSize: '12px' },
		dataLabels: { enabled: false },
		stroke: { width: 0 },
		plotOptions: { pie: { donut: { size: '62%' } } }
	});

	/** Meilleures ventes, en barres horizontales. */
	const productsChart = $derived<ApexOptions>({
		chart: { height: 320, type: 'bar', fontFamily: 'inherit', toolbar: { show: false } },
		series: [
			{
				name: 'Chiffre d’affaires',
				data: data.products.map((product) => Math.round(product.revenue))
			}
		],
		xaxis: {
			categories: data.products.map((product) =>
				product.name.length > 34 ? `${product.name.slice(0, 32)}…` : product.name
			),
			labels: { formatter: (value: string) => eur.format(Number(value)) }
		},
		yaxis: { labels: { style: { fontSize: '11px' } } },
		colors: [BLUE],
		plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } },
		dataLabels: { enabled: false },
		grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
		tooltip: { y: { formatter: (value: number) => eurPrecise.format(value) } }
	});

	const periodHref = (days: number) => `/admin/stats?jours=${days}`;
</script>

<svelte:head><title>Statistiques · Administration</title></svelte:head>

<PageHeader
	title="Statistiques"
	subtitle="Sur les {PERIOD_LABELS[data.days]} écoulés"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Statistiques' }]}
>
	{#snippet actions()}
		{#each data.periods as period (period)}
			<Button
				href={periodHref(period)}
				color={period === data.days ? 'primary' : 'alternative'}
				size="sm"
			>
				{PERIOD_LABELS[period]}
			</Button>
		{/each}
	{/snippet}
</PageHeader>

<!-- ================= Indicateurs ================= -->
{#snippet kpi(label: string, value: string, change: number | null, hint: string)}
	<Card class="max-w-none p-5">
		<p class="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
			{label}
		</p>
		<p class="mt-1 text-2xl font-bold text-gray-900 tabular-nums dark:text-white">{value}</p>
		<p class="mt-1.5 flex items-center gap-1 text-xs">
			{#if change === null}
				<span class="text-gray-400">Pas de comparaison possible</span>
			{:else if change >= 0}
				<ArrowUpOutline class="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
				<span class="font-medium text-green-600 dark:text-green-400">
					+{change.toFixed(1)} %
				</span>
				<span class="text-gray-400">{hint}</span>
			{:else}
				<ArrowDownOutline class="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
				<span class="font-medium text-red-600 dark:text-red-400">{change.toFixed(1)} %</span>
				<span class="text-gray-400">{hint}</span>
			{/if}
		</p>
	</Card>
{/snippet}

<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	{@render kpi(
		"Chiffre d'affaires TTC",
		eurPrecise.format(data.headline.revenue.value),
		data.headline.revenue.change,
		'vs période précédente'
	)}
	{@render kpi(
		'Commandes payées',
		num.format(data.headline.orders.value),
		data.headline.orders.change,
		'vs période précédente'
	)}
	{@render kpi(
		'Panier moyen',
		eurPrecise.format(data.headline.averageCart.value),
		data.headline.averageCart.change,
		'vs période précédente'
	)}
	{@render kpi(
		'Clients acheteurs',
		num.format(data.headline.customers.value),
		data.headline.customers.change,
		'vs période précédente'
	)}
</div>

<!-- ================= Courbe ================= -->
<Card class="mb-6 max-w-none p-6">
	<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">
		Chiffre d'affaires par jour
	</h2>
	{#if data.series.some((point) => point.revenue > 0)}
		<Chart options={revenueChart} />
	{:else}
		<p class="py-16 text-center text-sm text-gray-500">Aucune commande payée sur cette période.</p>
	{/if}
</Card>

<div class="grid gap-6 lg:grid-cols-3">
	<!-- ================= Meilleures ventes ================= -->
	<Card class="max-w-none p-6 lg:col-span-2">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Meilleures ventes</h2>
		{#if data.products.length > 0}
			<Chart options={productsChart} />

			<ul
				class="mt-4 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800"
			>
				{#each data.products.slice(0, 5) as product, i (i)}
					<li class="flex items-center justify-between gap-3 py-2 text-sm">
						<span class="min-w-0 truncate text-gray-700 dark:text-gray-300">{product.name}</span>
						<span class="shrink-0 text-gray-500 tabular-nums">
							{product.quantity} × · {eurPrecise.format(product.revenue)}
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="py-16 text-center text-sm text-gray-500">Aucune vente sur cette période.</p>
		{/if}
	</Card>

	<div class="space-y-6">
		<!-- ================= États ================= -->
		<Card class="max-w-none p-6">
			<h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">Commandes par état</h2>
			{#if data.states.length > 0}
				<Chart options={statesChart} />
			{:else}
				<p class="py-12 text-center text-sm text-gray-500">Aucune commande.</p>
			{/if}
		</Card>

		<!-- ================= Marge ================= -->
		<Card class="max-w-none p-6">
			<h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Marge</h2>
			<dl class="space-y-2.5 text-sm">
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Chiffre d'affaires HT</dt>
					<dd class="font-medium text-gray-900 tabular-nums dark:text-white">
						{eurPrecise.format(data.margin.revenueHt)}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Coût d'achat</dt>
					<dd class="font-medium text-gray-900 tabular-nums dark:text-white">
						{eurPrecise.format(data.margin.cost)}
					</dd>
				</div>
				<div
					class="flex justify-between gap-4 border-t border-gray-200 pt-2.5 dark:border-gray-700"
				>
					<dt class="font-medium text-gray-900 dark:text-white">Marge</dt>
					<dd
						class="font-semibold tabular-nums {data.margin.margin >= 0
							? 'text-green-600 dark:text-green-400'
							: 'text-red-600 dark:text-red-400'}"
					>
						{eurPrecise.format(data.margin.margin)}
						{#if data.margin.rate !== null}
							<span class="text-xs font-normal">({data.margin.rate.toFixed(1)} %)</span>
						{/if}
					</dd>
				</div>
			</dl>

			<!-- Le prix d'achat vient du catalogue courant, pas de la ligne de
			     commande : l'écart doit être annoncé. -->
			<p class="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-400 dark:border-gray-800">
				Estimation indicative, calculée sur les prix d'achat actuels du catalogue.
			</p>
		</Card>
	</div>
</div>
