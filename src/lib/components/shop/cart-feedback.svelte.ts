/**
 * Message de confirmation d'ajout au panier, partagé entre les cartes produit
 * (qui déclenchent l'ajout) et le layout (qui affiche le bandeau).
 */
export const cartFeedback = $state<{ message: string | null }>({ message: null });

/** Affiche une confirmation ; le bandeau se referme seul. */
export function notifyAddedToCart(message = 'Article ajouté à votre panier.') {
	cartFeedback.message = message;
}
