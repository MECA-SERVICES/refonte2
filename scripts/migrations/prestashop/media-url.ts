/**
 * Construction des URL d'images PrestaShop.
 *
 * PrestaShop ne stocke **aucune URL** : il stocke un `id_image` et dérive le
 * chemin sur disque en éclatant les chiffres de cet identifiant en répertoires.
 *
 *     id_image = 568712  →  /img/p/5/6/8/7/1/2/568712.jpg
 *
 * On reconstruit donc l'URL publique d'origine au moment de l'import.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  Pourquoi stocker l'URL de l'ancien site plutôt que rien ?
 *
 *  Le stockage cible (R2) n'existe pas encore. En consignant dès maintenant
 *  l'URL source **et** l'`id_image` d'origine (`product_media.legacy_ps_id`),
 *  la reprise des fichiers devient un simple parcours de `product_media` :
 *  télécharger `url`, pousser sur R2, réécrire `url`. Aucun retour à la base
 *  PrestaShop ne sera nécessaire — ce qui compte, la source étant en lecture
 *  seule derrière un tunnel SSH.
 * ────────────────────────────────────────────────────────────────────────────
 */
import { optionalEnv } from '../../lib/env.ts';

/**
 * Base publique des images de l'ancien site.
 *
 * Surchargeable par `PS_IMAGE_BASE_URL` dans `.env` : la boutique a pu changer
 * de domaine ou servir ses images depuis un CDN.
 */
export function imageBaseUrl(): string {
	return (optionalEnv('PS_IMAGE_BASE_URL') ?? 'https://www.mecaservicesshop.fr/img/p').replace(
		/\/+$/,
		''
	);
}

/**
 * Chemin éclaté PrestaShop pour un `id_image` : `568712` → `5/6/8/7/1/2`.
 *
 * C'est la convention `Image::getImgFolderStatic()` du cœur PrestaShop.
 */
export function shardedPath(idImage: number): string {
	return String(idImage).split('').join('/');
}

/**
 * URL publique d'une image produit sur l'ancien site.
 *
 * @param idImage identifiant `ps_image.id_image`
 * @param extension extension du fichier (PrestaShop stocke en `.jpg` par défaut)
 */
export function productImageUrl(idImage: number, extension = 'jpg'): string {
	return `${imageBaseUrl()}/${shardedPath(idImage)}/${idImage}.${extension}`;
}
