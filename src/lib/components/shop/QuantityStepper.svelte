<script lang="ts">
	import { MinusOutline, PlusOutline } from 'flowbite-svelte-icons';

	let {
		value = $bindable(1),
		min = 1,
		max,
		name = 'quantity',
		id = 'quantity',
		disabled = false,
		/** Soumet le formulaire parent à chaque changement (usage panier). */
		submitOnChange = false
	}: {
		value?: number;
		min?: number;
		max?: number;
		name?: string;
		id?: string;
		disabled?: boolean;
		submitOnChange?: boolean;
	} = $props();

	let field = $state<HTMLInputElement>();

	/** Applique une variation en respectant les bornes, puis soumet si demandé. */
	function step(delta: number) {
		const next = value + delta;
		if (next < min) return;
		if (max != null && next > max) return;
		value = next;
		if (submitOnChange) field?.form?.requestSubmit();
	}

	const buttonClass =
		'flex h-9 w-9 shrink-0 items-center justify-center text-shop-muted transition-colors hover:text-shop-blue disabled:cursor-not-allowed disabled:opacity-40';
</script>

<!--
	Sélecteur de quantité : deux boutons encadrent la valeur. Le champ reste un
	`input` nommé afin que le formulaire fonctionne sans JavaScript.
-->
<div
	class="inline-flex items-center border-[1.5px] border-shop-border bg-white {disabled
		? 'opacity-60'
		: ''}"
>
	<button
		type="button"
		onclick={() => step(-1)}
		disabled={disabled || value <= min}
		aria-label="Diminuer la quantité"
		class={buttonClass}
	>
		<MinusOutline class="h-3.5 w-3.5" />
	</button>

	<label class="sr-only" for={id}>Quantité</label>
	<input
		bind:this={field}
		{id}
		{name}
		type="number"
		{min}
		{max}
		{disabled}
		bind:value
		onchange={() => submitOnChange && field?.form?.requestSubmit()}
		class="h-9 w-11 [appearance:textfield] border-0 bg-transparent p-0 text-center text-sm font-bold text-shop-ink focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
	/>

	<button
		type="button"
		onclick={() => step(1)}
		disabled={disabled || (max != null && value >= max)}
		aria-label="Augmenter la quantité"
		class={buttonClass}
	>
		<PlusOutline class="h-3.5 w-3.5" />
	</button>
</div>
