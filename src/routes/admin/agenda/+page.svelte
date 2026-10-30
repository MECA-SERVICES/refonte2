<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import { PageHeader } from '$lib/components/admin';
	import type { PageProps } from './$types';

	/** Agenda de Dolibarr (rendez-vous, déplacements, tâches), archivé en lecture seule. */

	let { data }: PageProps = $props();

	const dayFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' });
	const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short' });
</script>

<svelte:head><title>Agenda Dolibarr · Administration</title></svelte:head>

<PageHeader
	title="Agenda Dolibarr"
	subtitle="Archive des rendez-vous et déplacements notés dans Dolibarr ({data.events
		.length}), en lecture seule"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Agenda Dolibarr' }]}
/>

<Card class="max-w-none p-0">
	{#if data.events.length === 0}
		<p class="p-6 text-center text-sm text-gray-500">Aucun événement repris.</p>
	{:else}
		<ul class="divide-y divide-gray-100 text-sm">
			{#each data.events as e (e.id)}
				<li class="px-5 py-3">
					<p class="text-xs text-gray-500">
						{dayFmt.format(new Date(e.startsAt))}{e.allDay
							? ' · journée'
							: ` · ${timeFmt.format(new Date(e.startsAt))}`} · {e.kind}{e.ownerName
							? ` · ${e.ownerName}`
							: ''}
					</p>
					<p class="font-medium text-gray-900">{e.title}</p>
					{#if e.customerId}
						<a
							href="/admin/customers/{e.customerId}"
							class="text-xs text-primary-700 hover:underline">{e.customerName ?? 'Client'}</a
						>
					{/if}
					{#if e.location}<p class="text-xs text-gray-600">Lieu : {e.location}</p>{/if}
					{#if e.note}<p class="mt-1 text-xs whitespace-pre-line text-gray-700">{e.note}</p>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</Card>
