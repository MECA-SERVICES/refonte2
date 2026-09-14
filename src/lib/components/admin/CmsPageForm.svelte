<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Card, Input, Label, Textarea, Toggle } from 'flowbite-svelte';
	import type { CmsPage } from '$lib/server/db/cms.schema';
	import type { Editor } from '@tiptap/core';

	/**
	 * Formulaire d'une page éditoriale.
	 *
	 * L'éditeur riche est chargé à la demande : ses dépendances pèsent lourd et
	 * n'ont rien à faire dans le reste du back-office.
	 */

	let {
		page,
		message,
		submitLabel = 'Enregistrer'
	}: {
		page?: Partial<CmsPage>;
		message?: string;
		submitLabel?: string;
	} = $props();

	/**
	 * Instance de l'éditeur.
	 *
	 * Le composant n'expose pas son contenu en liaison bidirectionnelle : on le
	 * lit donc au moment de l'envoi, via `getHTML()`.
	 */
	let editor = $state<Editor | null>(null);
	let contentField = $state<HTMLInputElement | null>(null);

	/** Recopie le contenu dans le champ caché juste avant la soumission. */
	function syncContent() {
		if (editor && contentField) contentField.value = editor.getHTML();
	}
</script>

<form method="POST" use:enhance={() => (syncContent(), undefined)} class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<input type="hidden" name="content" bind:this={contentField} value={page?.content ?? ''} />

	<Card class="max-w-none p-6">
		<div class="space-y-4">
			<div>
				<Label for="title" class="mb-2">Titre</Label>
				<Input id="title" name="title" required value={page?.title ?? ''} />
			</div>

			<div>
				<Label for="slug" class="mb-2">Adresse de la page</Label>
				<Input id="slug" name="slug" value={page?.slug ?? ''} placeholder="mentions-legales" />
				<p class="mt-1 text-xs text-gray-500">
					Laissez vide pour la déduire du titre. La page sera publiée sur
					<code class="rounded bg-gray-100 px-1 dark:bg-gray-800">/p/{page?.slug ?? '…'}</code>
				</p>
			</div>

			<Toggle name="isPublished" checked={page?.isPublished ?? false}>Page publiée</Toggle>
			<p class="text-xs text-gray-500">
				Une page non publiée reste accessible ici, mais renvoie une page introuvable sur la
				boutique.
			</p>
		</div>
	</Card>

	<!-- ================= Contenu ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Contenu</h2>

		{#await import('@flowbite-svelte-plugins/texteditor')}
			<div
				class="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
			></div>
		{:then { TextEditor, ToolbarRowWrapper, FormatButtonGroup, HeadingButtonGroup, ListButtonGroup, AlignmentButtonGroup, UndoRedoButtonGroup, Divider }}
			<TextEditor
				bind:editor
				content={page?.content ?? ''}
				placeholder="Rédigez le contenu de la page…"
				emoji={false}
				math={false}
			>
				<!--
					La barre d'outils n'apparaît que si des enfants sont fournis :
					`TextEditor` ne rend rien de lui-même. On ne retient que les
					commandes utiles à une page éditoriale — ni tableaux, ni vidéos,
					ni export.
				-->
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
			<!-- Repli : sans l'éditeur, la page reste modifiable en HTML brut plutôt
			     que bloquée. -->
			<Textarea name="content" rows={14} value={page?.content ?? ''} />
			<p class="mt-2 text-xs text-red-600">
				L'éditeur n'a pas pu être chargé ; le contenu est modifiable en HTML.
			</p>
		{/await}
	</Card>

	<!-- ================= Référencement ================= -->
	<Card class="max-w-none p-6">
		<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Référencement</h2>

		<div class="space-y-4">
			<div>
				<Label for="metaTitle" class="mb-2">Titre affiché par les moteurs</Label>
				<Input id="metaTitle" name="metaTitle" value={page?.metaTitle ?? ''} />
				<p class="mt-1 text-xs text-gray-500">Vide, le titre de la page est repris.</p>
			</div>

			<div>
				<Label for="metaDescription" class="mb-2">Description</Label>
				<Textarea
					id="metaDescription"
					name="metaDescription"
					rows={2}
					value={page?.metaDescription ?? ''}
				/>
			</div>
		</div>
	</Card>

	<div class="flex flex-wrap gap-3">
		<Button type="submit" color="primary">{submitLabel}</Button>
		<Button color="alternative" href="/admin/cms-pages">Annuler</Button>
	</div>
</form>
