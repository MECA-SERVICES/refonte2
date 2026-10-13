/**
 * Évaluation de la recherche : un jeu de saisies réelles et ce qu'on en attend.
 *
 * Sert de garde-fou à chaque réglage (synonymes, mots vides, classement) :
 * on juge sur des résultats, pas au ressenti. Les cas viennent des retours du
 * client et du CDC 08 (référence exacte en tête, R2).
 *
 * Usage :
 *   bun run search:eval            # tous les cas, 10 premiers résultats affichés
 *   bun run search:eval -- savon   # seulement les cas dont la saisie contient « savon »
 *
 * Code de sortie 1 si un cas échoue.
 */
import { Meilisearch } from 'meilisearch';
import { requireEnv } from './lib/env.ts';
import { color, log } from './lib/logger.ts';
import { PRODUCTS_INDEX, SUGGESTIONS_INDEX } from '../src/lib/server/search-index/settings.ts';

type Case = {
	q: string;
	/** Le 1er résultat doit correspondre. */
	first?: RegExp;
	/** Au moins `count` des 10 premiers doivent correspondre. */
	top?: { match: RegExp; count: number };
	/** Aucun des 10 premiers ne doit correspondre. */
	never?: RegExp;
};

const CASES: Case[] = [
	// Retour client : la saisie qui a lancé le chantier.
	{
		q: 'savon a main',
		first: /savon a main/i,
		top: { match: /savon|nettoyant.*main|lave.?main|p[aâ]te/i, count: 8 },
		never: /sans manche|m[aâ]choire|garde-main|prot[eè]ge-main/i
	},
	{ q: 'savon', top: { match: /savon/i, count: 10 } },
	{ q: 'nettoyant main', top: { match: /savon|nettoyant|lave/i, count: 6 } },

	// Fautes de frappe
	{ q: 'tondeuze', top: { match: /tondeuse/i, count: 8 } },
	{ q: 'husquvarna', top: { match: /husqvarna/i, count: 8 } },
	{ q: 'debrousailleuse', top: { match: /d[ée]brou?ssailleuse|trimmer/i, count: 6 } },

	// Références et code-barres (CDC 08-R2 : l'exact en tête)
	{ q: 'ISE-1729-733-210-30', first: /serrure gauche/i },
	{ q: '1729-733-210-30', first: /serrure gauche/i },
	{ q: '172973321030', first: /serrure gauche/i },
	{ q: 'TE00000258', first: /couvercle avant/i },
	{ q: '3606303040285', first: /limiteur/i },

	// Modèles et marques
	{ q: 'husqvarna 550 xp', top: { match: /550 xp/i, count: 3 } },
	{ q: 'filtre a huile kubota', top: { match: /filtre .*huile/i, count: 5 }, never: /sans/i },
	{ q: 'perceuse sans fil', top: { match: /perceuse/i, count: 6 } },

	// Vocabulaire courant
	{ q: 'robot tondeuse', top: { match: /robot/i, count: 5 } },
	// Un mot entier, pas un début de mot : pas de cloueurs « pneumatiques ».
	{ q: 'pneu', top: { match: /pneu\b|pneus|tyre/i, count: 10 }, never: /pneumatique/i },
	// Marque devenue nom commun : ses machines avant ses 29 000 pièces.
	// Gammes HD / HDS : nettoyeurs haute pression, souvent nommés par leur seul modèle.
	{ q: 'karcher', top: { match: /nettoyeur|aspirateur|souffleur|\bhds?\s?\d/i, count: 8 } },
	{ q: 'courroie', top: { match: /courroie|belt/i, count: 10 } },

	// Retour client : ce qui commence par la saisie passe devant les fiches qui
	// ne font que la contenir (« Filtre liquide refroidissement »).
	{
		q: 'liquide de refroidissement',
		top: { match: /^liquide (de )?refroidissement/i, count: 8 },
		never: /^filtre/i
	},

	// Synonymes : langue des fournisseurs (désignations anglaises, allemandes)
	{ q: 'courroie crantee', top: { match: /crant|dent|timing/i, count: 6 } },
	{ q: 'roulement', top: { match: /roulement|bearing/i, count: 10 } },
	{ q: 'vis hexagonale', top: { match: /vis|screw|schraube/i, count: 8 } },
	{ q: 'filtre a air', top: { match: /filtre .*air|air filter/i, count: 8 } },
	{ q: 'chambre a air', top: { match: /chambre|inner tube/i, count: 6 } },

	// Synonymes : vocabulaire du client
	{ q: 'disqueuse', top: { match: /meuleuse/i, count: 5 } },
	{
		q: 'rotofil',
		top: { match: /rotofil|d[ée]brou?ssailleuse|coupe.?bordure|trimmer/i, count: 5 }
	},
	{ q: 'tracteur tondeuse', top: { match: /tracteur|autoport|rider/i, count: 6 } },
	{ q: 'cle a choc', top: { match: /boulonneuse|choc/i, count: 5 } },
	{ q: 'huile 2 temps', top: { match: /2 ?t|2 temps|m[ée]lange/i, count: 5 } },
	{ q: 'chaussures de securite', top: { match: /chaussure|botte/i, count: 6 } },
	{ q: 'pantalon tronconneuse', top: { match: /pantalon/i, count: 5 } },
	{ q: 'prise de force', top: { match: /pdf|pto|prise de force|cardan|transmission/i, count: 6 } }
];

/** Suggestions de saisie : une frappe partielle et la complétion attendue. */
const SUGGESTION_CASES: { q: string; expect: RegExp }[] = [
	{ q: 'sav', expect: /^savon/ },
	{ q: 'filtre a h', expect: /^filtre à huile/ },
	{ q: 'cour', expect: /^courroie/ },
	{ q: 'tronc', expect: /^tronçonneuse/ },
	{ q: 'nettoyeur h', expect: /^nettoyeur haute pression/ }
];

const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
const client = new Meilisearch({
	host: requireEnv('MEILI_URL'),
	apiKey: requireEnv('MEILI_MASTER_KEY')
});
const index = client.index<{ id: number; name: string; reference: string | null }>(PRODUCTS_INDEX);

let failures = 0;

for (const testCase of CASES.filter((c) => !filter || c.q.includes(filter))) {
	const started = Date.now();
	// Mêmes paramètres que la page de résultats (`$lib/server/meili`) : le
	// dernier mot est un mot entier (espace finale), pas un début de mot.
	const { hits } = await index.search(`${testCase.q} `, {
		matchingStrategy: 'frequency',
		limit: 10,
		attributesToRetrieve: ['id', 'name', 'reference']
	});
	const ms = Date.now() - started;
	const names = hits.map((h) => h.name);

	const problems: string[] = [];
	if (testCase.first && !testCase.first.test(names[0] ?? '')) {
		problems.push(`1er résultat ≠ ${testCase.first}`);
	}
	if (testCase.top) {
		const matched = names.filter((n) => testCase.top!.match.test(n)).length;
		if (matched < testCase.top.count) {
			problems.push(`${matched}/${testCase.top.count} attendus ${testCase.top.match}`);
		}
	}
	if (testCase.never) {
		const bad = names.filter((n) => testCase.never!.test(n));
		if (bad.length > 0) problems.push(`indésirables : ${bad.join(' ; ')}`);
	}

	const status = problems.length === 0 ? color.green('OK ') : color.red('KO ');
	console.log(`\n${status} ${color.bold(testCase.q)} ${color.dim(`(${ms} ms)`)}`);
	names.forEach((name, i) => console.log(color.dim(`   ${String(i + 1).padStart(2)}. `) + name));
	for (const problem of problems) console.log(color.red(`   → ${problem}`));
	if (problems.length > 0) failures++;
}

// Suggestions : la 1re proposée doit compléter la frappe. Saisie brute, comme
// l'aperçu de la boutique (`searchPreview`).
const suggestions = client.index<{ text: string }>(SUGGESTIONS_INDEX);
for (const testCase of SUGGESTION_CASES.filter((c) => !filter || c.q.includes(filter))) {
	const { hits } = await suggestions.search(testCase.q, {
		matchingStrategy: 'all',
		limit: 5,
		attributesToRetrieve: ['text']
	});
	const texts = hits.map((h) => h.text);
	const ok = testCase.expect.test(texts[0] ?? '');
	const status = ok ? color.green('OK ') : color.red('KO ');
	console.log(
		`\n${status} ${color.bold(`suggestions « ${testCase.q} »`)} ${color.dim(texts.join(' · '))}`
	);
	if (!ok) {
		console.log(color.red(`   → 1re suggestion ≠ ${testCase.expect}`));
		failures++;
	}
}

if (failures > 0) {
	log.error(`${failures} cas en échec`);
	process.exitCode = 1;
} else {
	log.success('Tous les cas passent');
}
