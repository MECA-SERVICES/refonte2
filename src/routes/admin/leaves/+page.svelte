<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Checkbox, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import {
		balanceTypes,
		formatDays,
		LEAVE_STATUS,
		LEAVE_TYPE_LABELS,
		leaveDays,
		leaveTypes
	} from '$lib/leaves';
	import type { PageProps } from './$types';

	/**
	 * Mes congés : soldes (congés payés, RTT, acquis chaque mois), nouvelle
	 * demande avec le décompte en jours ouvrés, et demandes passées. Une
	 * demande attend l'approbation d'un administrateur.
	 */

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR');
	const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const today = new Date().toISOString().slice(0, 10);

	let type = $state<string>('paid');
	let startOn = $state(today);
	let endOn = $state(today);
	let startsAfternoon = $state(false);
	let endsAtNoon = $state(false);
	const days = $derived(leaveDays(startOn, endOn || startOn, startsAfternoon, endsAtNoon));

	const period = (r: {
		startOn: string;
		endOn: string;
		startsAfternoon: boolean;
		endsAtNoon: boolean;
	}) =>
		r.startOn === r.endOn
			? `${dateFmt.format(new Date(r.startOn))}${r.startsAfternoon ? ' après-midi' : r.endsAtNoon ? ' matin' : ''}`
			: `du ${dateFmt.format(new Date(r.startOn))}${r.startsAfternoon ? ' après-midi' : ''} au ${dateFmt.format(new Date(r.endOn))}${r.endsAtNoon ? ' midi' : ''}`;
</script>

<svelte:head><title>Mes congés · Administration</title></svelte:head>

<PageHeader
	title="Mes congés"
	subtitle="Soldes acquis chaque mois ; une demande attend l'approbation d'un administrateur"
	crumbs={[{ label: 'Accueil', href: '/admin' }, { label: 'Mes congés' }]}
>
	{#snippet actions()}
		{#if data.isAdmin}
			<Button color="alternative" href="/admin/leaves/team">Congés de l'équipe</Button>
		{/if}
	{/snippet}
</PageHeader>

<div class="mb-6 grid gap-4 sm:grid-cols-2">
	{#each balanceTypes as t (t)}
		<Card class="max-w-none p-5">
			<p class="text-sm text-gray-500">{LEAVE_TYPE_LABELS[t]}</p>
			<p class="text-2xl font-semibold text-gray-900 tabular-nums">
				{formatDays(data.balances[t] ?? 0)}
			</p>
		</Card>
	{/each}
</div>

<div class="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
	<Card class="max-w-none p-5">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Nouvelle demande</h2>
		<form
			method="POST"
			action="?/request"
			use:enhance
			data-success="Demande envoyée : elle attend l'approbation."
			class="space-y-3"
		>
			<div>
				<Label for="leave-type" class="mb-1 text-xs">Type</Label>
				<Select
					id="leave-type"
					name="type"
					size="sm"
					placeholder=""
					bind:value={type}
					items={leaveTypes.map((t) => ({ value: t, name: LEAVE_TYPE_LABELS[t] }))}
				/>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<div>
					<Label for="leave-start" class="mb-1 text-xs">Du</Label>
					<Input
						id="leave-start"
						name="startOn"
						type="date"
						size="sm"
						required
						bind:value={startOn}
					/>
				</div>
				<div>
					<Label for="leave-end" class="mb-1 text-xs">Au</Label>
					<Input id="leave-end" name="endOn" type="date" size="sm" required bind:value={endOn} />
				</div>
			</div>
			<Checkbox name="startsAfternoon" bind:checked={startsAfternoon}>
				Le premier jour, seulement l'après-midi
			</Checkbox>
			<Checkbox name="endsAtNoon" bind:checked={endsAtNoon}>
				Le dernier jour, seulement le matin
			</Checkbox>
			<div>
				<Label for="leave-description" class="mb-1 text-xs">Commentaire (facultatif)</Label>
				<Textarea id="leave-description" name="description" rows={2} />
			</div>
			<p class="text-sm text-gray-700">
				{days
					? `${formatDays(days)} ouvré${days > 1 ? 's' : ''}`
					: 'Aucun jour ouvré sur cette période.'}
			</p>
			<Button type="submit" size="sm" disabled={!days}>Envoyer la demande</Button>
		</form>
	</Card>

	<div class="min-w-0 space-y-6">
		<Card class="max-w-none p-0">
			<h2 class="px-5 pt-5 text-lg font-semibold text-gray-900">Mes demandes</h2>
			{#if data.requests.length === 0}
				<p class="p-5 text-sm text-gray-500">Aucune demande.</p>
			{:else}
				<ul class="divide-y divide-gray-100 text-sm">
					{#each data.requests as r (r.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
							<span class="min-w-0">
								<span class="font-medium text-gray-900">{LEAVE_TYPE_LABELS[r.type]}</span>
								<span class="text-gray-700"> · {period(r)} · {formatDays(Number(r.days))}</span>
								<span class="block text-xs text-gray-500">
									{r.reference}{r.description ? ` · ${r.description}` : ''}{r.decisionNote
										? ` · ${r.decisionNote}`
										: ''}
								</span>
							</span>
							<span class="flex items-center gap-2">
								<StateBadge
									color={LEAVE_STATUS[r.status].color}
									label={LEAVE_STATUS[r.status].label}
								/>
								{#if r.status === 'pending'}
									<form method="POST" action="?/cancel" use:enhance data-success="Demande annulée.">
										<input type="hidden" name="id" value={r.id} />
										<Button type="submit" size="xs" color="alternative">Annuler</Button>
									</form>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card>

		{#if data.log.length}
			<Card class="max-w-none p-5">
				<h2 class="mb-2 text-sm font-semibold text-gray-900">Mouvements de mes soldes</h2>
				<ul class="divide-y divide-gray-100 text-sm text-gray-700">
					{#each data.log as l (l.id)}
						<li class="flex justify-between gap-3 py-1.5">
							<span>
								{dateTimeFmt.format(new Date(l.createdAt))} · {LEAVE_TYPE_LABELS[l.type]} · {l.reason}
							</span>
							<span class="tabular-nums">
								{l.previousDays !== null ? Number(l.previousDays).toFixed(2) : '—'} → {l.newDays !==
								null
									? Number(l.newDays).toFixed(2)
									: '—'}
							</span>
						</li>
					{/each}
				</ul>
			</Card>
		{/if}
	</div>
</div>
