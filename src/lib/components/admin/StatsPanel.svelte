<script lang="ts">
	import { formatNumber, formatPrice, formatPriceRounded } from '$lib/money';
	import { PS_COLORS } from '$lib/admin-colors';
	import type { ApexOptions } from 'apexcharts';
	import { Chart } from '@flowbite-svelte-plugins/chart';
	import { untrack } from 'svelte';
	import { Button, Card, Input, Label, Select } from 'flowbite-svelte';
	import { ArrowUpOutline, ArrowDownOutline } from 'flowbite-svelte-icons';
	import { STATS_COMPARISONS, STATS_PRESETS, type StatsSelection } from '$lib/stats-range';
	import type {
		headlineStats,
		marginStats,
		ordersByState,
		revenueByDay,
		topProducts
	} from '$lib/server/stats';

	/**
	 * Statistiques du tableau de bord (demande client 13.1) : période au choix,
	 * comparée à une autre — la précédente, la même l'an dernier, ou des dates.
	 */
	type Resolved<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;
	let {
		data
	}: {
		data: {
			selection: StatsSelection;
			headline: Resolved<typeof headlineStats>;
			series: Resolved<typeof revenueByDay>;
			compareSeries: Resolved<typeof revenueByDay>;
			products: Resolved<typeof topProducts>;
			states: Resolved<typeof ordersByState>;
			margin: Resolved<typeof marginStats>;
		};
	} = $props();

	const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
	const longFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
	const fmtRange = (r: { from: string; to: string }) =>
		`du ${longFmt.format(new Date(`${r.from}T12:00`))} au ${longFmt.format(new Date(`${r.to}T12:00`))}`;

	/** Saisie du formulaire de période : les dates n'apparaissent qu'en « personnalisé ». */
	let preset = $state(untrack(() => data.selection.preset));
	let comparison = $state(untrack(() => data.selection.comparison));
	const compareHint = $derived(
		data.selection.comparison === 'annee-precedente'
			? 'vs l’an dernier'
			: data.selection.comparison === 'perso'
				? 'vs période comparée'
				: 'vs période précédente'
	);

	/** Couleurs des graphiques : celles du back-office (PrestaShop). */
	const LINE = PS_COLORS.primary;
	const MUTED = '#bbcdd2';
	const GRID = '#dbe6e9';

	/** Courbe du chiffre d'affaires. */
	const revenueChart = $derived<ApexOptions>({
		chart: {
			height: 320,
			type: 'area',
			fontFamily: 'inherit',
			toolbar: { show: false },
			dropShadow: { enabled: false }
		},
		// Les deux périodes se superposent jour à jour : le 1er jour de l'une
		// face au 1er jour de l'autre.
		series: [
			{
				name: 'Période',
				data: data.series.map((point) => Math.round(point.revenue))
			},
			{
				name: 'Comparaison',
				data: data.series.map((_, i) => Math.round(data.compareSeries[i]?.revenue ?? 0))
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
				formatter: (value: number) => formatPriceRounded(value),
				style: { fontSize: '11px' }
			}
		},
		colors: [LINE, MUTED],
		fill: {
			type: 'gradient',
			gradient: { opacityFrom: 0.4, opacityTo: 0 }
		},
		stroke: { curve: 'smooth', width: [2, 2], dashArray: [0, 5] },
		legend: { show: true, position: 'top', horizontalAlign: 'left' },
		dataLabels: { enabled: false },
		grid: { borderColor: GRID, strokeDashArray: 4 },
		tooltip: { y: { formatter: (value: number) => formatPrice(value) } }
	});

	/** Répartition des commandes par état. */
	const statesChart = $derived<ApexOptions>({
		chart: { height: 300, type: 'donut', fontFamily: 'inherit', toolbar: { show: false } },
		series: data.states.map((state) => state.total),
		labels: data.states.map((state) => state.label),
		// Les couleurs viennent des états eux-mêmes : l'opérateur retrouve celles
		// qu'il voit dans la liste des commandes.
		colors: data.states.map((state) => state.color ?? MUTED),
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
			labels: { formatter: (value: string) => formatPriceRounded(Number(value)) }
		},
		yaxis: { labels: { style: { fontSize: '11px' } } },
		colors: [LINE],
		plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } },
		dataLabels: { enabled: false },
		grid: { borderColor: GRID, strokeDashArray: 4 },
		tooltip: { y: { formatter: (value: number) => formatPrice(value) } }
	});
</script>

<!-- ================= Période ================= -->
<Card class="mb-6 max-w-none p-4">
	<form method="GET" class="flex flex-wrap items-end gap-3">
		<div>
			<Label for="periode" class="mb-1.5 text-xs">Période</Label>
			<Select
				id="periode"
				name="periode"
				size="sm"
				placeholder=""
				bind:value={preset}
				items={Object.entries(STATS_PRESETS).map(([value, name]) => ({ value, name }))}
			/>
		</div>
		{#if preset === 'perso'}
			<div>
				<Label for="du" class="mb-1.5 text-xs">Du</Label>
				<Input id="du" name="du" type="date" size="sm" value={data.selection.range.from} required />
			</div>
			<div>
				<Label for="au" class="mb-1.5 text-xs">Au</Label>
				<Input id="au" name="au" type="date" size="sm" value={data.selection.range.to} required />
			</div>
		{/if}
		<div>
			<Label for="comparer" class="mb-1.5 text-xs">Comparer à</Label>
			<Select
				id="comparer"
				name="comparer"
				size="sm"
				placeholder=""
				bind:value={comparison}
				items={Object.entries(STATS_COMPARISONS).map(([value, name]) => ({ value, name }))}
			/>
		</div>
		{#if comparison === 'perso'}
			<div>
				<Label for="cdu" class="mb-1.5 text-xs">Du</Label>
				<Input
					id="cdu"
					name="cdu"
					type="date"
					size="sm"
					value={data.selection.compare.from}
					required
				/>
			</div>
			<div>
				<Label for="cau" class="mb-1.5 text-xs">Au</Label>
				<Input
					id="cau"
					name="cau"
					type="date"
					size="sm"
					value={data.selection.compare.to}
					required
				/>
			</div>
		{/if}
		<Button type="submit" size="sm">Afficher</Button>
	</form>
	<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
		Période {fmtRange(data.selection.range)}, comparée à la période {fmtRange(
			data.selection.compare
		)}.
	</p>
</Card>

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
		formatPrice(data.headline.revenue.value),
		data.headline.revenue.change,
		compareHint
	)}
	{@render kpi(
		'Commandes payées',
		formatNumber(data.headline.orders.value),
		data.headline.orders.change,
		compareHint
	)}
	{@render kpi(
		'Panier moyen',
		formatPrice(data.headline.averageCart.value),
		data.headline.averageCart.change,
		compareHint
	)}
	{@render kpi(
		'Clients acheteurs',
		formatNumber(data.headline.customers.value),
		data.headline.customers.change,
		compareHint
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
							{product.quantity} × · {formatPrice(product.revenue)}
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
						{formatPrice(data.margin.revenueHt)}
					</dd>
				</div>
				<div class="flex justify-between gap-4">
					<dt class="text-gray-500">Coût d'achat</dt>
					<dd class="font-medium text-gray-900 tabular-nums dark:text-white">
						{formatPrice(data.margin.cost)}
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
						{formatPrice(data.margin.margin)}
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
