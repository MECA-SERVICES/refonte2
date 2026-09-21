<script lang="ts">
	import { enhance } from '$app/forms';
	import { Alert, Button, Card, Input, Label, Select, Textarea } from 'flowbite-svelte';
	import type { BlogArticle } from '$lib/server/db/blog.schema';
	import type { Editor } from '@tiptap/core';

	/**
	 * Formulaire d'un article de blog.
	 *
	 * L'éditeur riche est chargé à la demande, comme pour les pages éditoriales :
	 * ses dépendances n'ont pas à peser sur le reste du back-office.
	 */

	let {
		article,
		categories,
		message,
		submitLabel = 'Enregistrer',
		action
	}: {
		article?: Partial<BlogArticle>;
		/** Catégories ordonnées en arbre ; `depth` sert à l'indentation. */
		categories: { id: number; name: string; depth?: number }[];
		message?: string;
		submitLabel?: string;
		/** Action ciblée ; en édition, la page expose `?/save`. */
		action?: string;
	} = $props();

	let editor = $state<Editor | null>(null);
	let contentField = $state<HTMLInputElement | null>(null);

	/** Choix explicite du rédacteur ; sinon la valeur enregistrée fait foi. */
	let pickedType = $state<string | null>(null);
	const contentType = $derived(pickedType ?? article?.contentType ?? 'article');

	/** Recopie le contenu de l'éditeur juste avant l'envoi. */
	function syncContent() {
		if (editor && contentField) contentField.value = editor.getHTML();
	}

	const typeOptions = [
		{ value: 'article', name: 'Article rédigé' },
		{ value: 'video', name: 'Vidéo' },
		{ value: 'external_link', name: 'Lien externe' }
	];

	const statusOptions = [
		{ value: 'draft', name: 'Brouillon' },
		{ value: 'published', name: 'Publié' },
		{ value: 'archived', name: 'Archivé' }
	];

	/*
	 * Un article se range indifféremment dans une catégorie principale ou dans
	 * une sous-catégorie : l'indentation situe le choix dans l'arborescence.
	 */
	const categoryOptions = $derived([
		{ value: '', name: '— Aucune —' },
		...categories.map((c) => ({
			value: String(c.id),
			name: `${'\u00a0\u00a0'.repeat((c.depth ?? 1) - 1)}${(c.depth ?? 1) > 1 ? '└ ' : ''}${c.name}`
		}))
	]);
</script>

<form method="POST" {action} use:enhance={() => (syncContent(), undefined)} class="space-y-6">
	{#if message}
		<Alert color="red">{message}</Alert>
	{/if}

	<input type="hidden" name="content" bind:this={contentField} value={article?.content ?? ''} />

	<div class="grid gap-6 lg:grid-cols-3 lg:items-start">
		<div class="space-y-6 lg:col-span-2">
			<!-- ================= Identité ================= -->
			<Card class="max-w-none p-6">
				<div class="space-y-4">
					<div>
						<Label for="title" class="mb-2">Titre</Label>
						<Input id="title" name="title" required value={article?.title ?? ''} />
					</div>

					<div>
						<Label for="slug" class="mb-2">Adresse de l'article</Label>
						<Input id="slug" name="slug" value={article?.slug ?? ''} />
						<p class="mt-1 text-xs text-gray-500">
							Vide, elle est déduite du titre. L'article sera lisible sur
							<code class="rounded bg-gray-100 px-1 dark:bg-gray-800">
								/blog/{article?.slug ?? '…'}
							</code>
						</p>
					</div>

					<div>
						<Label for="excerpt" class="mb-2">Extrait</Label>
						<Textarea id="excerpt" name="excerpt" rows={2} value={article?.excerpt ?? ''} />
						<p class="mt-1 text-xs text-gray-500">
							Affiché dans la liste des articles. Requis avant publication.
						</p>
					</div>
				</div>
			</Card>

			<!-- ================= Contenu ================= -->
			<Card class="max-w-none p-6">
				<div class="mb-4">
					<Label for="contentType" class="mb-2">Forme du contenu</Label>
					<Select
						id="contentType"
						name="contentType"
						items={typeOptions}
						value={contentType}
						onchange={(e) => (pickedType = (e.currentTarget as HTMLSelectElement).value)}
					/>
				</div>

				{#if contentType === 'video'}
					<div>
						<Label for="videoUrl" class="mb-2">Adresse de la vidéo</Label>
						<Input id="videoUrl" name="videoUrl" value={article?.videoUrl ?? ''} />
					</div>
				{:else if contentType === 'external_link'}
					<div>
						<Label for="externalUrl" class="mb-2">Adresse de destination</Label>
						<Input id="externalUrl" name="externalUrl" value={article?.externalUrl ?? ''} />
						<p class="mt-1 text-xs text-gray-500">
							La liste renverra directement vers cette adresse.
						</p>
					</div>
				{:else}
					{#await import('@flowbite-svelte-plugins/texteditor')}
						<div
							class="h-64 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
						></div>
					{:then { TextEditor, ToolbarRowWrapper, FormatButtonGroup, HeadingButtonGroup, ListButtonGroup, AlignmentButtonGroup, UndoRedoButtonGroup, ImageButtonGroup, Divider }}
						<TextEditor
							bind:editor
							content={article?.content ?? ''}
							placeholder="Rédigez votre article…"
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
									{...{ code: false, subscript: false, superscript: false }}
								/>
								<Divider />
								<ListButtonGroup {editor} />
								<AlignmentButtonGroup {editor} />
								<Divider />
								<ImageButtonGroup {editor} />
							</ToolbarRowWrapper>
						</TextEditor>
					{:catch}
						<Textarea name="content" rows={14} value={article?.content ?? ''} />
						<p class="mt-2 text-xs text-red-600">
							L'éditeur n'a pas pu être chargé ; le contenu est modifiable en HTML.
						</p>
					{/await}
				{/if}
			</Card>

			<!-- ================= Référencement ================= -->
			<Card class="max-w-none p-6">
				<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Référencement</h2>
				<div class="space-y-4">
					<div>
						<Label for="metaTitle" class="mb-2">Titre affiché par les moteurs</Label>
						<Input id="metaTitle" name="metaTitle" value={article?.metaTitle ?? ''} />
						<p class="mt-1 text-xs text-gray-500">Vide, le titre de l'article est repris.</p>
					</div>
					<div>
						<Label for="metaDescription" class="mb-2">Description</Label>
						<Textarea
							id="metaDescription"
							name="metaDescription"
							rows={2}
							value={article?.metaDescription ?? ''}
						/>
						<p class="mt-1 text-xs text-gray-500">Vide, l'extrait en tient lieu.</p>
					</div>
				</div>
			</Card>
		</div>

		<!-- ================= Publication ================= -->
		<div class="space-y-6">
			<Card class="max-w-none p-6">
				<h2 class="mb-4 text-base font-semibold text-gray-900 dark:text-white">Publication</h2>

				<div class="space-y-4">
					<div>
						<Label for="status" class="mb-2">État</Label>
						<Select
							id="status"
							name="status"
							items={statusOptions}
							value={article?.status ?? 'draft'}
						/>
					</div>

					<div>
						<Label for="blogCategoryId" class="mb-2">Catégorie</Label>
						{#if categories.length === 0}
							<!-- Sans catégorie, la publication est refusée (R8) : le rédacteur
							     doit pouvoir en créer une sans quitter son brouillon. -->
							<p
								class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
							>
								Aucune catégorie n'existe encore. Elle est requise pour publier.
								<a
									href="/admin/blog/categories"
									class="font-semibold underline"
									target="_blank"
									rel="noopener"
								>
									En créer une
								</a>
							</p>
						{:else}
							<Select
								id="blogCategoryId"
								name="blogCategoryId"
								items={categoryOptions}
								value={article?.blogCategoryId ? String(article.blogCategoryId) : ''}
							/>
							<p class="mt-1 text-xs text-gray-500">
								<a href="/admin/blog/categories" class="hover:underline">Gérer les catégories</a>
							</p>
						{/if}
					</div>

					<div>
						<Label for="coverImageUrl" class="mb-2">Visuel de couverture</Label>
						<Input
							id="coverImageUrl"
							name="coverImageUrl"
							value={article?.coverImageUrl ?? ''}
							placeholder="https://…"
						/>
					</div>
				</div>

				<div class="mt-5 flex flex-wrap gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
					<Button type="submit" color="primary">{submitLabel}</Button>
					<Button color="alternative" href="/admin/blog">Annuler</Button>
				</div>
			</Card>
		</div>
	</div>
</form>
