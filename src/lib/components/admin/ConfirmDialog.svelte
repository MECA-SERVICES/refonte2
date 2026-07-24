<script lang="ts">
	import { Modal, Button } from 'flowbite-svelte';
	import { ExclamationCircleOutline } from 'flowbite-svelte-icons';

	let {
		open = $bindable(false),
		title = 'Confirmer',
		message,
		confirmLabel = 'Confirmer',
		cancelLabel = 'Annuler',
		onconfirm
	}: {
		open?: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onconfirm: () => void;
	} = $props();

	function confirm() {
		open = false;
		onconfirm();
	}
</script>

<Modal bind:open size="sm" {title}>
	<div class="text-center">
		<ExclamationCircleOutline class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-500" />
		<p class="mb-5 text-base text-gray-600 dark:text-gray-300">{message}</p>
		<div class="flex justify-center gap-3">
			<Button color="red" onclick={confirm}>{confirmLabel}</Button>
			<Button color="alternative" onclick={() => (open = false)}>{cancelLabel}</Button>
		</div>
	</div>
</Modal>
