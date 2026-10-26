<script lang="ts">
	import { Textarea } from 'flowbite-svelte';
	import type { Editor } from '@tiptap/core';

	/**
	 * Champ de texte mis en forme, comme sur PrestaShop, avec bascule vers le
	 * code HTML (bouton « Source » de la barre d'outils) — demande client 3.2.
	 *
	 * Le champ caché garde le HTML d'origine tant que personne n'écrit : un
	 * éditeur réécrit le HTML qu'il charge (classes et styles en ligne perdus),
	 * et enregistrer une fiche sans toucher à son texte ne doit rien en altérer.
	 * Dès la première modification, il prend le contenu de l'éditeur.
	 */
	let {
		name,
		value = '',
		placeholder = '',
		onlength
	}: {
		name: string;
		value?: string | null;
		placeholder?: string;
		/** Longueur du texte (sans balises) à chaque modification. */
		onlength?: (length: number) => void;
	} = $props();

	let editor = $state<Editor | null>(null);
	let field = $state<HTMLInputElement>();

	$effect(() => {
		const current = editor;
		if (!current) return;
		const sync = () => {
			if (field) field.value = current.getHTML();
			onlength?.(current.getText().length);
		};
		current.on('update', sync);
		return () => {
			current.off('update', sync);
		};
	});
</script>

{#await import('@flowbite-svelte-plugins/texteditor')}
	<div
		class="h-48 animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
	></div>
{:then { TextEditor, ToolbarRowWrapper, FormatButtonGroup, HeadingButtonGroup, ListButtonGroup, UndoRedoButtonGroup, SourceButtonGroup, Divider }}
	<input type="hidden" {name} bind:this={field} value={value ?? ''} />
	<TextEditor bind:editor content={value ?? ''} {placeholder} emoji={false} math={false}>
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
			<Divider />
			<!-- Bascule vers le code HTML, comme sur PrestaShop. -->
			<SourceButtonGroup {editor} html={false} />
		</ToolbarRowWrapper>
	</TextEditor>
{:catch}
	<!-- Repli : sans l'éditeur, le champ reste modifiable en HTML brut. -->
	<Textarea class="w-full" {name} rows={10} value={value ?? ''} />
	<p class="mt-2 text-xs text-red-600">
		L'éditeur n'a pas pu être chargé ; le contenu est modifiable en HTML.
	</p>
{/await}
