/**
 * Audit du front boutique : duplications de markup et opportunités Flowbite.
 *
 * L'outil lit les fichiers `.svelte` de la vitrine et signale trois choses :
 *
 *   1. les jeux de classes Tailwind répétés, candidats à un composant ;
 *   2. les éléments HTML bruts qui ont un équivalent dans flowbite-svelte ;
 *   3. les composants maison orphelins, jamais importés.
 *
 * Il ne modifie rien : il produit un rapport à lire. Le remplacement par un
 * composant Flowbite reste un choix humain — la bibliothèque impose ses rayons
 * et sa palette, que la charte MS SHOP contredit sur plusieurs points.
 *
 * Lancement : `bun run audit:front`
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['src/routes/(shop)', 'src/lib/components/shop'];

/**
 * Composants qui *implémentent* un motif : les y signaler serait absurde,
 * puisqu'ils sont précisément la solution proposée.
 */
const PRIMITIVES = [
	'ShopButton.svelte',
	'Panel.svelte',
	'Heading.svelte',
	'CartToast.svelte',
	'NavigationIndicator.svelte'
];

/** Nombre minimal de répétitions avant de signaler un jeu de classes. */
const MIN_REPEATS = 3;
/** En deçà, un jeu de classes est trop court pour valoir un composant. */
const MIN_CLASSES = 4;

/**
 * Éléments bruts ayant un équivalent Flowbite.
 * `caveat` dit ce que le remplacement coûterait, car la charte est carrée et
 * sombre là où Flowbite est arrondi et clair.
 */
const FLOWBITE_EQUIVALENTS: {
	pattern: RegExp;
	element: string;
	component: string;
	caveat: string;
}[] = [
	{
		pattern: /<button\b/g,
		element: '<button>',
		component: 'Button',
		caveat: 'impose un rayon et la palette primary — surcharger rounded-none + couleurs shop-*'
	},
	{
		pattern: /<input\b(?![^>]*type="hidden")/g,
		element: '<input>',
		component: 'Input',
		caveat: 'ajoute un anneau de focus et un rayon ; les champs cachés sont exclus'
	},
	{
		pattern: /<select\b/g,
		element: '<select>',
		component: 'Select',
		caveat: 'attend `items={[{ value, name }]}` plutôt que des <option>'
	},
	{
		pattern: /<table\b/g,
		element: '<table>',
		component: 'Table',
		caveat: 'apporte le zébrage et les bordures par défaut'
	},
	{
		pattern: /role="status"|aria-live=/g,
		element: 'zone de statut',
		component: 'Toast / Alert',
		caveat: 'gère position, fermeture et transition'
	},
	{
		pattern: /<a\b[^>]*class="[^"]*\b(?:bg-shop-(?:red|blue)|border-\[1\.5px\])/g,
		element: '<a> stylé en bouton',
		component: 'Button href=…',
		caveat: 'Button rend un <a> quand href est fourni'
	}
];

type ClassUsage = { file: string; line: number };

function listSvelteFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) listSvelteFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full);
	}
	return out;
}

/** Normalise un jeu de classes : ordre stable, expressions dynamiques ignorées. */
function normalize(classes: string): string | null {
	if (classes.includes('{')) return null; // classe conditionnelle : non comparable
	const tokens = classes.split(/\s+/).filter(Boolean);
	if (tokens.length < MIN_CLASSES) return null;
	return tokens.sort().join(' ');
}

function auditClasses(files: string[]) {
	const usages = new Map<string, ClassUsage[]>();

	for (const file of files) {
		const lines = readFileSync(file, 'utf8').split('\n');
		lines.forEach((text, index) => {
			for (const match of text.matchAll(/class="([^"]+)"/g)) {
				const key = normalize(match[1]);
				if (!key) continue;
				const list = usages.get(key) ?? [];
				list.push({ file, line: index + 1 });
				usages.set(key, list);
			}
		});
	}

	return [...usages.entries()]
		.filter(([, list]) => list.length >= MIN_REPEATS)
		.sort((a, b) => b[1].length - a[1].length);
}

function auditFlowbite(files: string[]) {
	const scanned = files.filter((f) => !PRIMITIVES.some((p) => f.endsWith(p)));

	return FLOWBITE_EQUIVALENTS.map((rule) => {
		const hits: ClassUsage[] = [];
		for (const file of scanned) {
			const lines = readFileSync(file, 'utf8').split('\n');
			lines.forEach((text, index) => {
				if (/^\s*(?:\*|\/\/|<!--)/.test(text)) return; // commentaire
				rule.pattern.lastIndex = 0;
				if (rule.pattern.test(text)) hits.push({ file, line: index + 1 });
			});
		}
		return { ...rule, hits };
	}).filter((rule) => rule.hits.length > 0);
}

/** Composants maison jamais importés ailleurs. */
function auditOrphans(files: string[]) {
	const components = files.filter((f) => f.includes('components/shop'));
	const allSource = files.map((f) => readFileSync(f, 'utf8')).join('\n');

	return components.filter((file) => {
		const name = file.split('/').pop()!.replace('.svelte', '');
		// Un composant est vivant s'il est importé par un autre fichier que lui-même.
		const imported = new RegExp(`import\\s+${name}\\b[^;]*from`).test(allSource);
		return !imported;
	});
}

// ---------------------------------------------------------------------------

const files = ROOTS.flatMap((root) => listSvelteFiles(root));
const short = (f: string) => relative(process.cwd(), f);

console.log(`\n=== AUDIT FRONT — ${files.length} fichiers .svelte ===\n`);

console.log('--- 1. Jeux de classes répétés (candidats à un composant) ---\n');
const duplicates = auditClasses(files);
if (duplicates.length === 0) console.log('  Aucun.\n');
for (const [classes, list] of duplicates.slice(0, 15)) {
	console.log(`  ${list.length}× ${classes.slice(0, 96)}${classes.length > 96 ? '…' : ''}`);
	for (const use of list.slice(0, 4)) console.log(`      ${short(use.file)}:${use.line}`);
	if (list.length > 4) console.log(`      … et ${list.length - 4} autre(s)`);
	console.log();
}

console.log('--- 2. Éléments bruts remplaçables par Flowbite ---\n');
for (const rule of auditFlowbite(files)) {
	console.log(`  ${rule.hits.length}× ${rule.element} → <${rule.component}>`);
	console.log(`      réserve : ${rule.caveat}`);
	for (const hit of rule.hits.slice(0, 3)) console.log(`      ${short(hit.file)}:${hit.line}`);
	if (rule.hits.length > 3) console.log(`      … et ${rule.hits.length - 3} autre(s)`);
	console.log();
}

console.log('--- 3. Composants maison orphelins ---\n');
const orphans = auditOrphans(files);
if (orphans.length === 0) console.log('  Aucun.\n');
for (const file of orphans) console.log(`  ${short(file)}`);
console.log();
