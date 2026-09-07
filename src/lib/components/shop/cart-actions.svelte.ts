import { invalidateAll } from '$app/navigation';
import type { SubmitFunction } from '@sveltejs/kit';
import { notifyAddedToCart } from './cart-feedback.svelte';

/**
 * Comportements partagés des formulaires panier.
 *
 * `invalidateAll` doit précéder `update` : sinon SvelteKit réapplique le
 * résultat de l'action sur des données encore périmées, et le rechargement qui
 * suit est écrasé — c'est ce qui figeait le compteur d'en-tête et le panier.
 */

/** Recharge les données, puis applique le résultat de l'action. */
export const refreshAfterSubmit: SubmitFunction = () => {
	return async ({ update }) => {
		await invalidateAll();
		await update({ reset: false, invalidateAll: false });
	};
};

/**
 * Ajout au panier : recharge le compteur d'en-tête et annonce la confirmation.
 * `onPending` permet à l'appelant d'afficher son propre état d'attente.
 */
export function createAddToCart(
	productName: () => string,
	onPending: (pending: boolean) => void
): SubmitFunction {
	return () => {
		onPending(true);
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await invalidateAll();
				notifyAddedToCart(`« ${productName()} » ajouté au panier.`);
			}
			await update({ reset: false, invalidateAll: false });
			onPending(false);
		};
	};
}
