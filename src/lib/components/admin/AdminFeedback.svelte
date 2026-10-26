<script lang="ts">
	import { navigating } from '$app/state';
	import { Toast, ToastContainer } from 'flowbite-svelte';
	import { CheckCircleSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { adminFeedback, dismiss } from './feedback.svelte';

	/**
	 * Retour visuel du back-office, posé une fois dans le layout :
	 * - une barre de progression en haut de l'écran, pendant un enregistrement
	 *   ou un changement de page ;
	 * - les notifications de `./feedback.svelte`.
	 */

	const busy = $derived(adminFeedback.pending > 0 || navigating.to !== null);
</script>

{#if busy}
	<div
		class="fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-primary-100 print:hidden"
		role="progressbar"
		aria-label="Chargement en cours"
	>
		<div class="admin-progress h-full w-1/3 bg-primary-600"></div>
	</div>
{/if}

<ToastContainer position="bottom-right" class="print:hidden">
	{#each adminFeedback.notices as notice (notice.id)}
		<Toast
			color={notice.tone === 'success' ? 'green' : 'red'}
			closeAriaLabel="Fermer"
			onclose={() => dismiss(notice.id)}
		>
			{#snippet icon()}
				{#if notice.tone === 'success'}
					<CheckCircleSolid class="h-5 w-5" />
				{:else}
					<ExclamationCircleSolid class="h-5 w-5" />
				{/if}
			{/snippet}
			{notice.message}
		</Toast>
	{/each}
</ToastContainer>

<style>
	.admin-progress {
		animation: admin-progress 1.1s ease-in-out infinite;
	}

	@keyframes admin-progress {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(300%);
		}
	}

	/* Bouton d'un formulaire en cours d'envoi (`enhance` de `./feedback.svelte`). */
	:global(button[data-loading]) {
		cursor: wait;
		opacity: 0.75;
	}

	:global(button[data-loading]::before) {
		content: '';
		display: inline-block;
		flex-shrink: 0;
		width: 1em;
		height: 1em;
		margin-inline-end: 0.5rem;
		border: 2px solid currentColor;
		border-inline-end-color: transparent;
		border-radius: 9999px;
		animation: -global-admin-spin 0.6s linear infinite;
	}

	@keyframes -global-admin-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.admin-progress,
		:global(button[data-loading]::before) {
			animation-duration: 2.4s;
		}
	}
</style>
