<script lang="ts">
	import { Button, Card } from 'flowbite-svelte';
	import { SUPPORT_STATUS_COLORS, SUPPORT_STATUS_LABELS } from '$lib/support';
	import type { SupportStatus } from '$lib/server/db/support.schema';

	/**
	 * Conversations du service client liées à une commande ou à un client,
	 * avec les raccourcis vers la liste complète et une nouvelle conversation.
	 */

	type Thread = {
		id: number;
		reference: string;
		subject: string;
		status: SupportStatus;
		lastMessageAt: Date | string;
		unreadByStaff: number;
	};

	let {
		threads,
		total,
		listHref,
		newHref
	}: {
		threads: Thread[];
		total: number;
		listHref: string;
		newHref: string;
	} = $props();

	const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' });
</script>

<Card class="max-w-none p-6 print:hidden">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900 dark:text-white">
			Messages <span class="font-normal text-gray-400">({total})</span>
		</h2>
		<Button href={newHref} size="xs" color="alternative">Nouveau</Button>
	</div>

	{#if threads.length === 0}
		<p class="text-sm text-gray-500">Aucune conversation.</p>
	{:else}
		<ul class="divide-y divide-gray-100 dark:divide-gray-800">
			{#each threads as t (t.id)}
				<li class="py-2.5 first:pt-0 last:pb-0">
					<a href="/admin/customer-service/{t.id}" class="group block">
						<span class="flex items-center gap-2 text-sm">
							<span
								class="h-2 w-2 shrink-0 rounded-full"
								style="background-color: {SUPPORT_STATUS_COLORS[t.status]}"
								title={SUPPORT_STATUS_LABELS[t.status]}
							></span>
							<span
								class="truncate group-hover:underline {t.unreadByStaff > 0
									? 'font-semibold text-gray-900 dark:text-white'
									: 'text-gray-700 dark:text-gray-300'}"
							>
								{t.subject}
							</span>
						</span>
						<span class="ms-4 block text-xs text-gray-500">
							{t.reference} · {dateFmt.format(new Date(t.lastMessageAt))}
						</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if total > threads.length}
			<a
				href={listHref}
				class="mt-3 inline-block text-sm text-primary-700 hover:underline dark:text-primary-400"
			>
				Voir les {total} conversations
			</a>
		{/if}
	{/if}
</Card>
