/**
 * Source Dolibarr : la base `doli_bdd1` (Dolibarr 13, « Meca Services »).
 *
 * Elle est hébergée sur le même serveur MySQL que PrestaShop, derrière le même
 * tunnel SSH et avec le même compte : on réutilise donc la connexion de
 * `../prestashop/source-db.ts`, et son garde-fou **lecture seule**
 * (`assertReadOnly`). Le compte MySQL a les droits d'écriture sur cette base :
 * seul ce garde-fou l'en empêche. On n'écrit jamais dans Dolibarr.
 *
 * La connexion pointe sur la base PrestaShop par défaut : chaque requête
 * préfixe ses tables par `DOLI` (ex. `${DOLI}.llx_entrepot`).
 *
 * L'ancienne instance `dolibarr_bdd1` (Dolibarr 12, 3 factures, dernière en
 * 2023) n'est pas reprise. Voir `MIGRATION-DOLIBARR.md`.
 */
export { sourceQuery, closeSourceDb } from '../prestashop/source-db.ts';

/** Base Dolibarr active, à préfixer devant chaque table. */
export const DOLI = '`doli_bdd1`';
