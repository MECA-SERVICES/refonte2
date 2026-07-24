<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { OrderState } from '$lib/server/db/order.schema';

	let {
		state,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		state?: Partial<OrderState>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-2xl p-6">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="label" class="mb-2">Libellé</Label>
				<Input id="label" name="label" required value={state?.label ?? ''} />
			</div>
			<div>
				<Label for="code" class="mb-2">Code</Label>
				<Input
					id="code"
					name="code"
					required
					value={state?.code ?? ''}
					placeholder="ex : shipping"
				/>
			</div>
			<div>
				<Label for="color" class="mb-2">Couleur</Label>
				<Input id="color" name="color" type="color" value={state?.color ?? '#6b7280'} />
			</div>
			<div>
				<Label for="position" class="mb-2">Ordre d'affichage</Label>
				<Input id="position" name="position" type="number" value={String(state?.position ?? 0)} />
			</div>
		</div>

		<div class="mt-4 space-y-3">
			<Toggle name="isPaid" checked={state?.isPaid ?? false}>Considérée comme payée</Toggle>
			<Toggle name="isShipped" checked={state?.isShipped ?? false}>
				Considérée comme expédiée
			</Toggle>
			<Toggle name="isFinal" checked={state?.isFinal ?? false}>
				État final (clôture la commande)
			</Toggle>
			<Toggle name="sendEmailOnChange" checked={state?.sendEmailOnChange ?? false}>
				Envoyer un email au client
			</Toggle>
			<Toggle name="hideFromClient" checked={state?.hideFromClient ?? false}>
				Masquer côté client
			</Toggle>
		</div>
	</Card>

	<div class="flex max-w-2xl justify-end gap-3">
		<Button color="alternative" href="/admin/order-states">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>
