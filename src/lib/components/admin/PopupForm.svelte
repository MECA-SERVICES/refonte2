<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Card, Input, Label, Select, Textarea, Toggle } from 'flowbite-svelte';
	import type { Popup } from '$lib/server/db/popup.schema';
	import { POPUP_SCOPES, POPUP_SCOPE_LABELS, type PopupScope } from '$lib/popups';
	import type { Editor } from '@tiptap/core';

	/**
	 * Formulaire d'une pop-up d'annonce.
	 *
	 * L'éditeur riche est chargé à la demande, comme pour les pages CMS : ses
	 * dépendances pèsent lourd et n'ont rien à faire dans le reste du
	 * back-office.
	 */

	let {
		popup,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		popup?: Partial<Popup> | null;
		message?: string;
		submitLabel?: string;
		/** Action ciblée ; en édition, la page expose `?/save`. */
		action?: string;
	} = $props();

	let editor = $state<Editor | null>(null);
	let contentField = $state<HTMLInputElement | null>(null);

	/** Recopie le contenu de l'éditeur juste avant l'envoi. */
	function syncContent() {
		if (editor && contentField) contentField.value = editor.getHTML();
	}

	/** Choix explicite ; sinon la valeur enregistrée fait foi. */
	let pickedScope = $state<PopupScope | null>(null);
	const scope = $derived(pickedScope ?? (popup?.scope as PopupScope) ?? 'all');

	const scopeOptions = POPUP_SCOPES.map((value) => ({
		value,
		name: POPUP_SCOPE_LABELS[value]
	}));

	/**
	 * Un champ `datetime-local` attend `AAAA-MM-JJTHH:MM`, en heure locale.
	 *
	 * `toISOString` renverrait de l'UTC, décalant l'heure affichée : les
	 * composantes sont donc lues une à une.
	 */
	function toLocalInput(value: Date | string | null | undefined): string {
		if (!value) return '';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '';

		const p = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
	}
</script>

<form method="POST" {action} use:enhance={() => (syncContent(), undefined)} class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<input type="hidden" name="content" bind:this={contentField} value={popup?.content ?? ''} />

	<!-- ================= Identification ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Annonce</h2>

		<div class="space-y-4">
			<div>
				<Label for="name" class="mb-2">Nom interne</Label>
				<Input
					id="name"
					name="name"
					required
					value={popup?.name ?? ''}
					placeholder="Fermeture estivale 2026"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Sert à retrouver l'annonce ici ; jamais affiché aux visiteurs.
				</p>
			</div>

			<div>
				<Label for="title" class="mb-2">Titre affiché</Label>
				<Input id="title" name="title" value={popup?.title ?? ''} />
				<p class="mt-1 text-xs text-gray-500">Laissez vide pour une annonce sans titre.</p>
			</div>

			<div>
				<Label for="imageUrl" class="mb-2">Image</Label>
				<Input
					id="imageUrl"
					name="imageUrl"
					value={popup?.imageUrl ?? ''}
					placeholder="https://…"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Adresse d'une image, affichée en haut de l'annonce.
				</p>
			</div>

			<Toggle name="isActive" checked={popup?.isActive ?? false}>Annonce active</Toggle>
			<p class="text-xs text-gray-500">
				Une annonce inactive ne s'affiche jamais, même dans sa période de diffusion.
			</p>
		</div>
	</Card>

	<!-- ================= Contenu ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Message</h2>

		{#await import('@flowbite-svelte-plugins/texteditor')}
			<div
				class="h-48 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
			></div>
		{:then { TextEditor, ToolbarRowWrapper, FormatButtonGroup, ListButtonGroup, UndoRedoButtonGroup, Divider }}
			<TextEditor
				bind:editor
				content={popup?.content ?? ''}
				placeholder="Rédigez votre annonce…"
				emoji={false}
				math={false}
			>
				<!-- Barre réduite : une annonce est courte, les titres et les
				     alignements n'y ont pas leur place. -->
				<ToolbarRowWrapper>
					<UndoRedoButtonGroup {editor} />
					<Divider />
					<FormatButtonGroup
						{editor}
						{...{ code: false, highlight: false, subscript: false, superscript: false }}
					/>
					<Divider />
					<ListButtonGroup {editor} />
				</ToolbarRowWrapper>
			</TextEditor>
		{:catch}
			<!-- Repli : sans l'éditeur, le message reste modifiable en HTML brut
			     plutôt que bloqué. -->
			<Textarea name="content" rows={8} value={popup?.content ?? ''} />
			<p class="mt-2 text-xs text-red-600">
				L'éditeur n'a pas pu être chargé ; le message est modifiable en HTML.
			</p>
		{/await}

		<div class="mt-5 grid gap-4 sm:grid-cols-2">
			<div>
				<Label for="ctaLabel" class="mb-2">Libellé du bouton</Label>
				<Input
					id="ctaLabel"
					name="ctaLabel"
					value={popup?.ctaLabel ?? ''}
					placeholder="En savoir plus"
				/>
			</div>
			<div>
				<Label for="ctaUrl" class="mb-2">Adresse du bouton</Label>
				<Input id="ctaUrl" name="ctaUrl" value={popup?.ctaUrl ?? ''} placeholder="/p/livraison" />
			</div>
		</div>
		<p class="mt-1 text-xs text-gray-500">Sans libellé ni adresse, aucun bouton n'est affiché.</p>
	</Card>

	<!-- ================= Diffusion ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Diffusion</h2>

		<div class="space-y-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<Label for="startsAt" class="mb-2">Début</Label>
					<Input
						id="startsAt"
						name="startsAt"
						type="datetime-local"
						value={toLocalInput(popup?.startsAt)}
					/>
				</div>
				<div>
					<Label for="endsAt" class="mb-2">Fin</Label>
					<Input
						id="endsAt"
						name="endsAt"
						type="datetime-local"
						value={toLocalInput(popup?.endsAt)}
					/>
				</div>
			</div>
			<p class="text-xs text-gray-500">
				Dates facultatives : sans date de fin, l'annonce court jusqu'à sa désactivation.
			</p>

			<div>
				<Label for="scope" class="mb-2">Pages concernées</Label>
				<Select
					id="scope"
					name="scope"
					items={scopeOptions}
					value={scope}
					onchange={(e) =>
						(pickedScope = (e.currentTarget as HTMLSelectElement).value as PopupScope)}
				/>
			</div>

			{#if scope === 'paths'}
				<div>
					<Label for="paths" class="mb-2">Adresses ciblées</Label>
					<Textarea id="paths" name="paths" rows={4} value={popup?.paths ?? ''} />
					<p class="mt-1 text-xs text-gray-500">
						Une adresse par ligne, par exemple <code>/panier</code>. Un astérisque final couvre tout
						ce qui suit : <code>/blog*</code> vise le blog entier.
					</p>
				</div>
			{:else}
				<!-- La valeur est conservée même quand le champ est masqué : changer
				     de portée puis revenir ne doit pas effacer la saisie. -->
				<input type="hidden" name="paths" value={popup?.paths ?? ''} />
			{/if}

			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="delaySeconds" class="mb-2">Délai (secondes)</Label>
					<Input
						id="delaySeconds"
						name="delaySeconds"
						type="number"
						min="0"
						max="120"
						value={String(popup?.delaySeconds ?? 0)}
					/>
					<p class="mt-1 text-xs text-gray-500">Attente avant affichage.</p>
				</div>
				<div>
					<Label for="dismissDays" class="mb-2">Silence (jours)</Label>
					<Input
						id="dismissDays"
						name="dismissDays"
						type="number"
						min="0"
						max="365"
						value={String(popup?.dismissDays ?? 7)}
					/>
					<p class="mt-1 text-xs text-gray-500">Après fermeture par le visiteur.</p>
				</div>
				<div>
					<Label for="priority" class="mb-2">Priorité</Label>
					<Input id="priority" name="priority" type="number" value={String(popup?.priority ?? 0)} />
					<p class="mt-1 text-xs text-gray-500">La plus haute l'emporte.</p>
				</div>
			</div>
		</div>
	</Card>

	<div class="flex flex-wrap gap-3">
		<Button type="submit" color="primary">{submitLabel}</Button>
		<Button color="alternative" href="/admin/popups">Annuler</Button>
	</div>
</form>
