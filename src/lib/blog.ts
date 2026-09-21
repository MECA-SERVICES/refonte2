/**
 * Vocabulaire partagé du blog (CDC 33).
 *
 * Lu aussi bien par le navigateur que par le serveur : le module
 * `$lib/server/blog` garde les accès à la base et réexporte ce qui suit, sur
 * le modèle de `$lib/repairs`.
 */

/**
 * Profondeur maximale de l'arborescence des catégories.
 *
 * Trois niveaux couvrent le besoin éditorial sans imposer la détection de
 * cycles ni les requêtes récursives qu'exigerait une imbrication libre.
 */
export const BLOG_CATEGORY_MAX_DEPTH = 3;
