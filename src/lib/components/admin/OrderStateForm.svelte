<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Card, Label, Input, Toggle, Button, Alert } from 'flowbite-svelte';
	import StateBadge from './StateBadge.svelte';
	import type { OrderState } from '$lib/server/db/order.schema';

	let {
		// Renommée : `state` entre en conflit avec la rune `$state`.
		state: current,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		state?: Partial<OrderState>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();

	/** Couleur courante : alimente la pastille d'aperçu pendant le choix. */
	let color = $state(untrack(() => current?.color ?? '#6b7280'));

	type Flag =
		'isActive' | 'isPaid' | 'isShipped' | 'isFinal' | 'sendEmailOnChange' | 'hideFromClient';
	const flags: { name: Flag; label: string; fallback: boolean }[] = [
		{ name: 'isActive', label: 'Active', fallback: true },
		{ name: 'isPaid', label: 'Considérée comme payée', fallback: false },
		{ name: 'isShipped', label: 'Considérée comme expédiée', fallback: false },
		{ name: 'isFinal', label: 'État final (clôture la commande)', fallback: false },
		{ name: 'sendEmailOnChange', label: 'Envoyer un email au client', fallback: false },
		{ name: 'hideFromClient', label: 'Masquer côté client', fallback: false }
	];
</script>

<form method="POST" {action} use:enhance class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<Card class="max-w-none p-6">
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="label" class="mb-2">Libellé</Label>
				<Input id="label" name="label" required value={current?.label ?? ''} />
			</div>
			<div>
				<Label for="code" class="mb-2">Code</Label>
				<Input
					id="code"
					name="code"
					required
					value={current?.code ?? ''}
					placeholder="ex : shipping"
				/>
			</div>
			<div>
				<Label for="color" class="mb-2">Couleur</Label>
				<!--
					Sélecteur natif : habillé en champ texte par Flowbite, la pastille
					de couleur n'était presque pas visible.
				-->
				<div class="flex items-center gap-3">
					<input
						id="color"
						name="color"
						type="color"
						bind:value={color}
						class="h-10 w-14 cursor-pointer rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="font-mono text-sm text-gray-600 dark:text-gray-300">{color}</span>
					<StateBadge label={current?.label || 'Aperçu'} {color} />
				</div>
			</div>
			<div>
				<Label for="position" class="mb-2">Ordre d'affichage</Label>
				<Input id="position" name="position" type="number" value={String(current?.position ?? 0)} />
			</div>
		</div>

		<!--
			L'interrupteur seul est cliquable : le Toggle Flowbite est un <label>
			étiré sur toute la ligne, un clic loin à droite le basculait. Le texte
			est donc placé à côté, hors du label.
		-->
		<div class="mt-4 space-y-3">
			{#each flags as flag (flag.name)}
				<div class="flex items-center">
					<Toggle
						id="flag-{flag.name}"
						name={flag.name}
						checked={current?.[flag.name] ?? flag.fallback}
						class="w-fit"
						aria-label={flag.label}
					/>
					<span class="text-sm font-medium text-gray-900 dark:text-gray-300">{flag.label}</span>
				</div>
			{/each}
		</div>
	</Card>

	<div class="flex justify-end gap-3">
		<Button color="alternative" href="/admin/order-states">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>
