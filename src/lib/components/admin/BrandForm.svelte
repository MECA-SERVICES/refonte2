<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Label, Input, Textarea, Toggle, Button, Alert } from 'flowbite-svelte';
	import type { Brand } from '$lib/server/db/catalog.schema';
	import type { Editor } from '@tiptap/core';

	let {
		brand,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		brand?: Partial<Brand>;
		message?: string;
		submitLabel?: string;
		action?: string;
	} = $props();

	/**
	 * Éditeur de la page de marque (CDC 12).
	 *
	 * Comme pour les pages CMS, le contenu n'est pas lié en bidirectionnel : on
	 * le recopie dans un champ caché au moment de l'envoi.
	 */
	let editor = $state<Editor | null>(null);
	let contentField = $state<HTMLInputElement | null>(null);

	function syncContent() {
		if (editor && contentField) contentField.value = editor.getHTML();
	}
</script>

<form method="POST" {action} use:enhance={() => (syncContent(), undefined)} class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<input
		type="hidden"
		name="pageContent"
		bind:this={contentField}
		value={brand?.pageContent ?? ''}
	/>

	<Card class="max-w-2xl p-6">
		<div class="space-y-4">
			<div>
				<Label for="name" class="mb-2">Nom</Label>
				<Input id="name" name="name" required value={brand?.name ?? ''} />
			</div>

			<div>
				<Label for="slug" class="mb-2">Slug (optionnel)</Label>
				<Input id="slug" name="slug" value={brand?.slug ?? ''} placeholder="ex : bosch" />
				<p class="mt-1 text-xs text-gray-500">
					La page de marque sera publiée sur
					<code class="rounded bg-gray-100 px-1 dark:bg-gray-800">/marque/{brand?.slug ?? '…'}</code
					>
				</p>
			</div>

			<div>
				<Label for="logoUrl" class="mb-2">URL du logo</Label>
				<Input id="logoUrl" name="logoUrl" value={brand?.logoUrl ?? ''} />
				<p class="mt-1 text-xs text-gray-500">
					Sert aussi d'image de repli pour les produits sans photo.
				</p>
			</div>

			<div>
				<Label for="description" class="mb-2">Description</Label>
				<Textarea id="description" name="description" rows={3} value={brand?.description ?? ''} />
			</div>

			<Toggle name="isActive" checked={brand?.isActive ?? true}>Marque active</Toggle>
		</div>
	</Card>

	<!-- ================= Page de marque ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-1 text-base font-semibold text-gray-900 dark:text-white">Page de marque</h2>
		<p class="mb-4 text-xs text-gray-500">
			Contenu affiché sur la boutique. Les compteurs (références, stock, rayons) sont calculés
			automatiquement depuis le catalogue.
		</p>

		<div class="space-y-4">
			<div>
				<Label for="heroImageUrl" class="mb-2">Image d'en-tête</Label>
				<Input
					id="heroImageUrl"
					name="heroImageUrl"
					value={brand?.heroImageUrl ?? ''}
					placeholder="/img/marques/bosch-hero.jpg"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Bandeau large en haut de la page (format conseillé : 1600 × 300 px).
				</p>
			</div>

			{#if brand?.heroImageUrl}
				<img
					src={brand.heroImageUrl}
					alt=""
					class="h-32 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700"
				/>
			{/if}

			<div>
				<Label for="tagline" class="mb-2">Accroche</Label>
				<Input
					id="tagline"
					name="tagline"
					value={brand?.tagline ?? ''}
					placeholder="Revendeur et réparateur agréé depuis 1985"
				/>
			</div>

			<div>
				<Label class="mb-2">Texte de présentation</Label>
				{#await import('@flowbite-svelte-plugins/texteditor')}
					<div
						class="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
					></div>
				{:then { TextEditor, ToolbarRowWrapper, FormatButtonGroup, HeadingButtonGroup, ListButtonGroup, AlignmentButtonGroup, UndoRedoButtonGroup, Divider }}
					<TextEditor
						bind:editor
						content={brand?.pageContent ?? ''}
						placeholder="Présentez la marque, son histoire, les gammes distribuées…"
						emoji={false}
						math={false}
					>
						<ToolbarRowWrapper>
							<UndoRedoButtonGroup {editor} />
							<Divider />
							<HeadingButtonGroup {editor} fontFamily={false} fontSize={false} />
							<Divider />
							<FormatButtonGroup
								{editor}
								{...{ code: false, highlight: false, subscript: false, superscript: false }}
							/>
							<Divider />
							<ListButtonGroup {editor} />
							<AlignmentButtonGroup {editor} />
						</ToolbarRowWrapper>
					</TextEditor>
				{:catch}
					<Textarea name="pageContent" rows={12} value={brand?.pageContent ?? ''} />
					<p class="mt-2 text-xs text-red-600">
						L'éditeur n'a pas pu être chargé ; le contenu est modifiable en HTML.
					</p>
				{/await}
			</div>
		</div>
	</Card>

	<!-- ================= Référencement ================= -->
	<Card class="max-w-2xl p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Référencement</h2>

		<div class="space-y-4">
			<div>
				<Label for="metaTitle" class="mb-2">Titre de la page</Label>
				<Input id="metaTitle" name="metaTitle" value={brand?.metaTitle ?? ''} />
				<p class="mt-1 text-xs text-gray-500">
					Par défaut : « {brand?.name ?? 'Marque'} — MS Shop ».
				</p>
			</div>

			<div>
				<Label for="metaDescription" class="mb-2">Description de la page</Label>
				<Textarea
					id="metaDescription"
					name="metaDescription"
					rows={2}
					value={brand?.metaDescription ?? ''}
				/>
			</div>
		</div>
	</Card>

	<div class="flex max-w-2xl justify-end gap-3">
		<Button color="alternative" href="/admin/brands">Annuler</Button>
		<Button type="submit">{submitLabel}</Button>
	</div>
</form>
