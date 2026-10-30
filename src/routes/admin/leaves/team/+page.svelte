<script lang="ts">
	import { enhance } from '$lib/components/admin/feedback.svelte';
	import { Button, Card, Input } from 'flowbite-svelte';
	import { PageHeader, StateBadge } from '$lib/components/admin';
	import {
		balanceTypes,
		formatDays,
		LEAVE_STATUS,
		LEAVE_TYPE_LABELS,
		leaveStatuses
	} from '$lib/leaves';
	import type { PageProps } from './$types';

	/**
	 * Congés de l'équipe (administrateurs) : demandes à approuver, soldes de
	 * chacun (corrigibles, avec un motif), toutes les demandes et le journal des
	 * soldes. Approuver décompte le solde ; annuler un congé approuvé le recrédite.
	 */

	let { data }: PageProps = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR');
	const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
	const pending = $derived(data.requests.filter((r) => r.status === 'pending'));
	let editing = $state<string | null>(null);

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

<svelte:head><title>Congés de l'équipe · Administration</title></svelte:head>

<PageHeader
	title="Congés de l'équipe"
	subtitle="Approbations, soldes et historique"
	crumbs={[
		{ label: 'Accueil', href: '/admin' },
		{ label: 'Mes congés', href: '/admin/leaves' },
		{ label: "Congés de l'équipe" }
	]}
/>

{#if pending.length}
	<Card class="mb-6 max-w-none p-0">
		<h2 class="px-5 pt-5 text-lg font-semibold text-gray-900">À approuver ({pending.length})</h2>
		<ul class="divide-y divide-gray-100 text-sm">
			{#each pending as r (r.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
					<span class="min-w-0">
						<span class="font-medium text-gray-900">{r.employeeName}</span>
						<span class="text-gray-700">
							· {LEAVE_TYPE_LABELS[r.type]} · {period(r)} · {formatDays(Number(r.days))}</span
						>
						<span class="block text-xs text-gray-500"
							>{r.reference}{r.description ? ` · ${r.description}` : ''}</span
						>
					</span>
					<form
						method="POST"
						use:enhance
						data-success="Décision enregistrée."
						class="flex items-center gap-2"
					>
						<input type="hidden" name="id" value={r.id} />
						<Input
							name="note"
							size="sm"
							placeholder="Motif (obligatoire pour refuser)"
							class="w-64"
						/>
						<Button type="submit" formaction="?/approve" size="xs" color="green">Approuver</Button>
						<Button type="submit" formaction="?/refuse" size="xs" color="red">Refuser</Button>
					</form>
				</li>
			{/each}
		</ul>
	</Card>
{/if}

<Card class="mb-6 max-w-none p-0">
	<h2 class="px-5 pt-5 text-lg font-semibold text-gray-900">Soldes</h2>
	<table class="mt-3 w-full text-sm">
		<thead class="border-b border-gray-200 text-xs text-gray-600 uppercase">
			<tr>
				<th scope="col" class="px-5 py-2 text-start">Salarié</th>
				{#each balanceTypes as t (t)}
					<th scope="col" class="px-5 py-2 text-end">{LEAVE_TYPE_LABELS[t]}</th>
				{/each}
				<th scope="col" class="px-5 py-2"><span class="sr-only">Actions</span></th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100">
			{#each data.balances as m (m.id)}
				<tr>
					<td class="px-5 py-2.5">
						<span class="font-medium text-gray-900">{m.name}</span>
						<span class="block text-xs text-gray-500">{m.email}</span>
					</td>
					{#each balanceTypes as t (t)}
						<td class="px-5 py-2.5 text-end tabular-nums">{formatDays(m.balances[t] ?? 0)}</td>
					{/each}
					<td class="px-5 py-2.5 text-end">
						<Button
							size="xs"
							color="alternative"
							onclick={() => (editing = editing === m.id ? null : m.id)}>Corriger</Button
						>
					</td>
				</tr>
				{#if editing === m.id}
					<tr>
						<td colspan={balanceTypes.length + 2} class="bg-gray-50 px-5 py-3">
							<div class="flex flex-wrap gap-4">
								{#each balanceTypes as t (t)}
									<form
										method="POST"
										action="?/setBalance"
										use:enhance
										data-success="Solde corrigé."
										class="flex items-center gap-2"
									>
										<input type="hidden" name="userId" value={m.id} />
										<input type="hidden" name="type" value={t} />
										<span class="text-xs text-gray-600">{LEAVE_TYPE_LABELS[t]}</span>
										<Input
											name="days"
											size="sm"
											class="w-20"
											inputmode="decimal"
											value={(m.balances[t] ?? 0).toFixed(2)}
											aria-label="Nouveau solde {LEAVE_TYPE_LABELS[t]} de {m.name}"
										/>
										<Input
											name="reason"
											size="sm"
											class="w-48"
											required
											placeholder="Motif (report, régularisation…)"
										/>
										<Button type="submit" size="xs">Enregistrer</Button>
									</form>
								{/each}
							</div>
						</td>
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</Card>

<Card class="mb-6 max-w-none p-0">
	<div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
		<h2 class="text-lg font-semibold text-gray-900">Toutes les demandes</h2>
		<nav class="flex flex-wrap gap-2 text-sm">
			<a
				href="/admin/leaves/team"
				class={data.status ? 'text-primary-700 hover:underline' : 'font-semibold'}>Toutes</a
			>
			{#each leaveStatuses as s (s)}
				<a
					href="/admin/leaves/team?status={s}"
					class={data.status === s ? 'font-semibold' : 'text-primary-700 hover:underline'}
					>{LEAVE_STATUS[s].label}</a
				>
			{/each}
		</nav>
	</div>
	{#if data.requests.length === 0}
		<p class="p-5 text-sm text-gray-500">Aucune demande.</p>
	{:else}
		<ul class="mt-2 divide-y divide-gray-100 text-sm">
			{#each data.requests as r (r.id)}
				<li class="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5">
					<span class="min-w-0">
						<span class="font-medium text-gray-900">{r.employeeName}</span>
						<span class="text-gray-700">
							· {LEAVE_TYPE_LABELS[r.type]} · {period(r)} · {formatDays(Number(r.days))}</span
						>
						<span class="block text-xs text-gray-500">
							{r.reference}{r.description ? ` · ${r.description}` : ''}{r.decisionNote
								? ` · ${r.decisionNote}`
								: ''}
						</span>
					</span>
					<span class="flex items-center gap-2">
						<StateBadge color={LEAVE_STATUS[r.status].color} label={LEAVE_STATUS[r.status].label} />
						{#if r.status === 'approved'}
							<form
								method="POST"
								action="?/cancel"
								use:enhance
								data-success="Congé annulé et recrédité."
							>
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

<Card class="max-w-none p-5">
	<h2 class="mb-2 text-sm font-semibold text-gray-900">Journal des soldes</h2>
	<ul class="divide-y divide-gray-100 text-sm text-gray-700">
		{#each data.log as l (l.id)}
			<li class="flex justify-between gap-3 py-1.5">
				<span>
					{dateTimeFmt.format(new Date(l.createdAt))} · {l.employeeName} · {LEAVE_TYPE_LABELS[
						l.type
					]} · {l.reason}{l.actorName ? ` (${l.actorName})` : ''}
				</span>
				<span class="tabular-nums">
					{l.previousDays !== null ? Number(l.previousDays).toFixed(2) : '—'} → {l.newDays !== null
						? Number(l.newDays).toFixed(2)
						: '—'}
				</span>
			</li>
		{:else}
			<li class="py-2 text-gray-500">Aucun mouvement.</li>
		{/each}
	</ul>
</Card>
