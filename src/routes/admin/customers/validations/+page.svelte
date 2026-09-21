<script lang="ts">
	import {
		Badge,
		Button,
		Card,
		Input,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell
	} from 'flowbite-svelte';
	import { SearchOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/admin/PageHeader.svelte';
	import Pagination from '$lib/components/admin/Pagination.svelte';
	import {
		CUSTOMER_STATUSES,
		CUSTOMER_STATUS_COLORS,
		CUSTOMER_STATUS_LABELS,
		CUSTOMER_TYPE_LABELS,
		normalizeCustomerType
	} from '$lib/accounts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });

	/** Onglets de la file, un par état de dossier. */
	const tabs = $derived(
		CUSTOMER_STATUSES.map((s) => ({
			value: s,
			label: CUSTOMER_STATUS_LABELS[s],
			count: data.counts[s] ?? 0
		}))
	);

	/** Assemble une adresse à partir des seuls paramètres renseignés. */
	function query(params: Record<string, string | undefined>) {
		const parts = Object.entries(params)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
		return parts.length > 0 ? `?${parts.join('&')}` : '?';
	}

	const pageHref = (page: number) =>
		query({
			etat: data.status !== 'pending' ? data.status : undefined,
			type: data.requestType,
			q: data.search || undefined,
			page: page > 1 ? String(page) : undefined
		});

	const tabHref = (value: string) =>
		query({
			etat: value !== 'pending' ? value : undefined,
			type: data.requestType,
			q: data.search || undefined
		});

	/** Raison sociale ou nom de la collectivité, selon le type de dossier. */
	function entityName(row: (typeof data.rows)[number]) {
		return row.companyName || row.collectivityName || '—';
	}

	/**
	 * Un dossier professionnel sans SIRET ne peut pas être instruit (R3).
	 * Le signaler dans la liste évite d'ouvrir le détail pour rien.
	 */
	function incomplete(row: (typeof data.rows)[number]) {
		return normalizeCustomerType(row.requestType) === 'pro' && !row.siret;
	}
</script>

<svelte:head><title>Validations de comptes · Administration</title></svelte:head>

<PageHeader
	title="Validations de comptes"
	subtitle="{data.total} dossier{data.total > 1 ? 's' : ''}"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Clients', href: '/admin/customers' },
		{ label: 'Validations' }
	]}
/>

<div class="mb-4 flex flex-wrap items-center gap-2">
	{#each tabs as tab (tab.value)}
		{@const active = data.status === tab.value}
		<a href={tabHref(tab.value)}>
			<Button size="sm" color={active ? 'primary' : 'alternative'}>
				{tab.label}
				<Badge class="ms-2" color={active ? 'gray' : CUSTOMER_STATUS_COLORS[tab.value]}>
					{tab.count}
				</Badge>
			</Button>
		</a>
	{/each}
</div>

<form method="GET" class="mb-4 flex flex-wrap gap-2">
	{#if data.status !== 'pending'}
		<input type="hidden" name="etat" value={data.status} />
	{/if}
	{#if data.requestType}
		<input type="hidden" name="type" value={data.requestType} />
	{/if}
	<Input
		name="q"
		value={data.search}
		placeholder="Nom, email, raison sociale, SIRET…"
		class="max-w-sm"
	/>
	<Button type="submit" color="alternative">
		<SearchOutline class="me-2 h-4 w-4" /> Rechercher
	</Button>
</form>

{#if data.rows.length === 0}
	<Card class="max-w-none p-10 text-center">
		<p class="text-gray-600 dark:text-gray-300">
			{data.status === 'pending'
				? 'Aucun dossier en attente. Tout est traité.'
				: 'Aucun dossier dans cet état.'}
		</p>
	</Card>
{:else}
	<Card class="max-w-none p-0">
		<Table hoverable>
			<TableHead>
				<TableHeadCell>Client</TableHeadCell>
				<TableHeadCell>Type</TableHeadCell>
				<TableHeadCell>Raison sociale</TableHeadCell>
				<TableHeadCell>SIRET</TableHeadCell>
				<TableHeadCell>Déposé le</TableHeadCell>
				<TableHeadCell class="text-end">Action</TableHeadCell>
			</TableHead>
			<TableBody>
				{#each data.rows as row (row.id)}
					<TableBodyRow>
						<TableBodyCell>
							<span class="font-medium">{row.firstName} {row.lastName}</span>
							<span class="block text-xs text-gray-500">{row.email}</span>
						</TableBodyCell>
						<TableBodyCell>
							{CUSTOMER_TYPE_LABELS[normalizeCustomerType(row.requestType)]}
						</TableBodyCell>
						<TableBodyCell>{entityName(row)}</TableBodyCell>
						<TableBodyCell>
							{#if row.siret}
								<span class="font-mono text-xs">{row.siret}</span>
							{:else}
								<Badge color="red">Manquant</Badge>
							{/if}
						</TableBodyCell>
						<TableBodyCell>
							{date.format(new Date(row.createdAt))}
							{#if row.infoRequestedAt}
								<!-- Dossier relancé : il reste en attente des pièces réclamées. -->
								<Badge class="ms-1" color="purple">Complément demandé</Badge>
							{/if}
						</TableBodyCell>
						<TableBodyCell class="text-end">
							{#if incomplete(row)}
								<Badge class="me-2" color="yellow">Dossier incomplet</Badge>
							{/if}
							<a href="/admin/customers/validations/{row.id}">
								<Button size="xs" color="alternative">Examiner</Button>
							</a>
						</TableBodyCell>
					</TableBodyRow>
				{/each}
			</TableBody>
		</Table>
	</Card>

	{#if data.pageCount > 1}
		<div class="mt-4">
			<Pagination
				page={data.page}
				pageCount={data.pageCount}
				total={data.total}
				hrefFor={pageHref}
			/>
		</div>
	{/if}
{/if}
