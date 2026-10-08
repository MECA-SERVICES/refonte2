<script lang="ts">
	import { untrack } from 'svelte';
	import { Card, Textarea } from 'flowbite-svelte';
	import { InfoCircleOutline } from 'flowbite-svelte-icons';

	/**
	 * Note interne enregistrée automatiquement, sans bouton : une seconde
	 * après la dernière frappe, et aussitôt le champ quitté.
	 *
	 * L'envoi passe par une action de formulaire appelée en `fetch` : la page
	 * ne se recharge pas, le reste de l'écran ne bouge pas pendant la saisie.
	 */

	let {
		title = 'Note interne',
		value: initial,
		action,
		field = 'privateNote',
		hint = 'Visible uniquement en back-office.',
		placeholder = ''
	}: {
		title?: string;
		value: string | null;
		/** Action SvelteKit recevant le texte, ex. `?/saveNote`. */
		action: string;
		/** Nom du champ envoyé à l'action. */
		field?: string;
		hint?: string;
		placeholder?: string;
	} = $props();

	let note = $state(untrack(() => initial ?? ''));
	let lastSaved = untrack(() => initial ?? '');
	let status = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function save() {
		const value = note;
		if (value === lastSaved) return;
		status = 'saving';
		const body = new FormData();
		body.set(field, value);
		try {
			const response = await fetch(action, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = await response.json();
			if (result.type !== 'success') throw new Error(result.type);
			lastSaved = value;
			// Une saisie survenue pendant l'envoi relance un enregistrement.
			if (note !== value) schedule();
			else status = 'saved';
		} catch {
			status = 'error';
		}
	}

	function schedule() {
		clearTimeout(timer);
		timer = setTimeout(save, 1000);
	}

	function flush() {
		clearTimeout(timer);
		save();
	}
</script>

<Card class="max-w-none p-6">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
		<span class="text-xs text-gray-500 print:hidden" aria-live="polite">
			{#if status === 'saving'}
				Enregistrement…
			{:else if status === 'saved'}
				Enregistrée
			{:else if status === 'error'}
				<span class="text-red-600 dark:text-red-400">Échec de l'enregistrement</span>
			{/if}
		</span>
	</div>
	<p
		class="mb-3 flex items-start gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200 print:hidden"
	>
		<InfoCircleOutline class="mt-px h-4 w-4 shrink-0" />
		{hint} Enregistrement automatique.
	</p>
	<Textarea
		class="w-full text-sm print:hidden"
		rows={6}
		bind:value={note}
		oninput={schedule}
		onblur={flush}
		{placeholder}
	/>
	<!-- À l'impression, le texte remplace le champ. -->
	<p class="hidden text-sm whitespace-pre-line print:block">{note || '—'}</p>
</Card>
