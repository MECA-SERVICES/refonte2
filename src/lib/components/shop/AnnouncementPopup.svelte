<script lang="ts">
	import { CloseOutline } from 'flowbite-svelte-icons';
	import { dismissKey, isDismissed } from '$lib/popups';

	/**
	 * Pop-up d'annonce de la boutique.
	 *
	 * Le serveur a déjà choisi quelle pop-up est éligible pour cette adresse ;
	 * il reste ici à décider *quand* l'afficher — délai, et mémoire des
	 * fermetures précédentes, propre au navigateur du visiteur.
	 *
	 * Bâti sur l'élément natif `<dialog>` : il apporte gratuitement le piège de
	 * focus, la fermeture par Échap et la sémantique de dialogue modal, qu'un
	 * `<div>` superposé obligerait à réimplémenter — mal.
	 */

	let {
		popup
	}: {
		popup: {
			id: number;
			title: string | null;
			/** HTML déjà assaini côté serveur par `sanitizeHtml`. */
			content: string;
			imageUrl: string | null;
			ctaLabel: string | null;
			ctaUrl: string | null;
			delaySeconds: number;
			dismissDays: number;
		} | null;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * Mémoire des fermetures.
	 *
	 * `localStorage` est indisponible en navigation privée stricte ou quand le
	 * visiteur bloque le stockage : l'accès est protégé, et l'échec se traduit
	 * par un affichage — mieux vaut montrer l'annonce que la perdre.
	 */
	function readDismissal(id: number): string | null {
		try {
			return localStorage.getItem(dismissKey(id));
		} catch {
			return null;
		}
	}

	function remember(id: number) {
		try {
			localStorage.setItem(dismissKey(id), String(Date.now()));
		} catch {
			// Sans stockage, la pop-up reparaîtra à la prochaine visite : c'est
			// une gêne, pas une panne.
		}
	}

	$effect(() => {
		const current = popup;
		if (!current || !dialog) return;

		// Déjà fermée récemment : on n'ouvre pas.
		if (isDismissed(readDismissal(current.id), current.dismissDays)) return;

		const timer = setTimeout(() => dialog?.showModal(), current.delaySeconds * 1000);
		return () => clearTimeout(timer);
	});

	function close() {
		dialog?.close();
	}

	/**
	 * Un clic sur le fond referme.
	 *
	 * L'arrière-plan d'un `<dialog>` appartient à l'élément lui-même : un clic
	 * dessus a le dialogue pour cible, jamais son contenu.
	 */
	function onBackdropClick(event: MouseEvent) {
		if (event.target === dialog) close();
	}
</script>

{#if popup}
	<dialog
		bind:this={dialog}
		onclick={onBackdropClick}
		onclose={() => popup && remember(popup.id)}
		aria-labelledby={popup.title ? `popup-title-${popup.id}` : undefined}
		class="fixed top-1/2 left-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-[1.5px] border-shop-ink bg-white p-0 shadow-xl backdrop:bg-shop-ink/60"
	>
		<div class="relative">
			<button
				type="button"
				onclick={close}
				aria-label="Fermer l'annonce"
				class="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center border-[1.5px] border-transparent bg-white/90 text-shop-ink hover:border-shop-ink"
			>
				<CloseOutline class="h-4 w-4" />
			</button>

			{#if popup.imageUrl}
				<!-- Alternative vide : l'image illustre un texte déjà présent. -->
				<img src={popup.imageUrl} alt="" class="block w-full object-cover" />
			{/if}

			<div class="px-6 py-6">
				{#if popup.title}
					<h2
						id="popup-title-{popup.id}"
						class="font-display text-[20px] font-extrabold tracking-[-0.02em] text-shop-ink"
					>
						{popup.title}
					</h2>
				{/if}

				{#if popup.content}
					<div class="shop-prose mt-3 text-[14.5px] leading-relaxed text-shop-ink-soft">
						<!--
							Contenu rédigé en back-office et assaini par `sanitizeHtml`
							côté serveur, comme les pages CMS : le nettoyage ne dépend
							jamais de la vue.
						-->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html popup.content}
					</div>
				{/if}

				{#if popup.ctaLabel && popup.ctaUrl}
					<a
						href={popup.ctaUrl}
						onclick={close}
						class="mt-5 inline-block border-[1.5px] border-shop-ink bg-shop-ink px-4 py-2.5 font-display text-[14px] font-bold text-white hover:bg-shop-blue"
					>
						{popup.ctaLabel}
					</a>
				{/if}
			</div>
		</div>
	</dialog>
{/if}
