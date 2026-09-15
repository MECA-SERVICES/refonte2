/**
 * Jeu de démonstration du blog.
 *
 * Cinq articles de motoculture, illustrés par des photos Unsplash (licence
 * libre, usage commercial autorisé). Destiné à peupler l'écran le temps que le
 * client rédige ses propres contenus — à supprimer avant la mise en ligne.
 *
 * Usage :
 *   bun run blog:seed            # insère les articles
 *   bun run blog:seed -- --clear # vide le blog
 */

import postgres from 'postgres';
import { loadEnv } from './lib/env.ts';

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL manquant');

const sql = postgres(url, { ssl: 'require' });

if (process.argv.includes('--clear')) {
	await sql`DELETE FROM blog_article`;
	await sql`DELETE FROM blog_category`;
	console.log('Blog vidé.');
	await sql.end();
	process.exit(0);
}

const CATEGORIES = [
	{ name: 'Entretien', slug: 'entretien', color: '#314192', sortOrder: 1 },
	{ name: 'Bien choisir', slug: 'bien-choisir', color: '#e31d27', sortOrder: 2 },
	{ name: 'Saisons', slug: 'saisons', color: '#ec6608', sortOrder: 3 }
];

/** Photo Unsplash en 1200 px de large, suffisant pour une couverture. */
const cover = (id: string) =>
	`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

const ARTICLES = [
	{
		category: 'entretien',
		title: 'Hivernage de la tondeuse : les cinq gestes qui comptent',
		excerpt:
			"Une tondeuse remisée sans préparation démarre mal au printemps, quand elle démarre. Voici ce que notre atelier fait systématiquement avant l'hiver.",
		cover: cover('1458245201577-fc8a130b8829'),
		content: `<h2>Vidanger ou stabiliser le carburant</h2>
<p>L'essence sans plomb se dégrade en deux à trois mois. Les dépôts qu'elle laisse dans la cuve du carburateur sont la première cause de panne au redémarrage.</p>
<p>Deux options : vider entièrement le réservoir et faire tourner le moteur jusqu'à l'arrêt, ou ajouter un stabilisateur puis laisser tourner cinq minutes pour qu'il atteigne le carburateur.</p>
<h2>Changer l'huile pendant que le moteur est chaud</h2>
<p>L'huile usagée contient des résidus acides qui attaquent les portées pendant les mois d'immobilisation. Une vidange à chaud les évacue bien mieux qu'à froid.</p>
<h2>Nettoyer le carter de coupe</h2>
<ul><li>Débrancher la bougie avant toute intervention sous la machine</li><li>Gratter l'herbe sèche collée, qui retient l'humidité</li><li>Vérifier l'état de la lame et son équilibrage</li></ul>
<h2>Retirer la bougie et huiler le cylindre</h2>
<p>Quelques gouttes d'huile moteur dans le cylindre, puis deux tours de lanceur : le film protecteur évite la corrosion des segments.</p>
<h2>Stocker au sec, batterie débranchée</h2>
<p>Sur une tondeuse à batterie, ne jamais laisser l'accumulateur complètement déchargé. Une charge à 60 % environ préserve sa capacité.</p>`
	},
	{
		category: 'entretien',
		title: "Affûter la chaîne de sa tronçonneuse sans l'abîmer",
		excerpt:
			'Une chaîne émoussée fatigue le moteur et produit de la sciure fine au lieu de copeaux. Le repère est simple, la correction aussi.',
		cover: cover('1474742509976-ddec6b387356'),
		content: `<h2>Reconnaître une chaîne émoussée</h2>
<p>Le signe ne trompe pas : une chaîne affûtée sort des <strong>copeaux</strong>, une chaîne usée de la <strong>sciure</strong>. Si vous devez appuyer pour que la machine morde, l'affûtage est en retard.</p>
<h2>Le bon diamètre de lime</h2>
<p>Il dépend du pas de la chaîne, pas de la marque. Une lime trop fine creuse la gouge et fragilise la dent.</p>
<ul><li>Pas 3/8" basse profondeur : lime de 4,0 mm</li><li>Pas 0,325" : lime de 4,8 mm</li><li>Pas 3/8" : lime de 5,2 mm</li></ul>
<h2>L'angle, toujours le même</h2>
<p>Trente degrés pour la plupart des chaînes de coupe transversale. L'erreur la plus fréquente est de varier l'angle d'une dent à l'autre : la chaîne tire alors d'un côté et la coupe part de travers.</p>
<blockquote><p>Comptez le même nombre de passes sur chaque dent. C'est la régularité qui fait la coupe droite, pas la force.</p></blockquote>
<h2>Ne pas oublier les limiteurs</h2>
<p>Tous les trois ou quatre affûtages, contrôlez la hauteur des limiteurs de profondeur avec une jauge. Trop hauts, la chaîne n'attaque plus ; trop bas, elle broute et fatigue le moteur.</p>`
	},
	{
		category: 'bien-choisir',
		title: 'Largeur de coupe : comment la choisir selon son terrain',
		excerpt:
			'La plus large possible n’est pas toujours la bonne. Le critère décisif, c’est la surface — mais aussi ce qu’il y a dessus.',
		cover: cover('1590820292118-e256c3ac2676'),
		content: `<h2>Un repère simple</h2>
<p>La largeur de coupe conditionne le temps de tonte, mais aussi la maniabilité. Voici ce que nous conseillons le plus souvent en atelier :</p>
<ul><li><strong>Jusqu'à 500 m²</strong> — 40 à 46 cm, tondeuse poussée</li><li><strong>500 à 1 500 m²</strong> — 46 à 53 cm, tractée de préférence</li><li><strong>1 500 à 4 000 m²</strong> — 53 cm minimum, tractée</li><li><strong>Au-delà</strong> — autoportée, 80 cm et plus</li></ul>
<h2>Ce que le tableau ne dit pas</h2>
<p>Un terrain de 800 m² planté d'arbres et bordé de massifs se tond moins vite qu'un rectangle de 1 200 m². Dans ce cas, une machine plus étroite passe partout et vous fera gagner du temps.</p>
<h2>La pente change tout</h2>
<p>Au-delà de 15 %, une tondeuse poussée devient éprouvante. La traction n'est plus un confort, c'est une nécessité — et au-delà de 25 %, il faut passer sur une machine spécifiquement conçue pour le dévers.</p>
<h2>Le poids compte autant que la largeur</h2>
<p>Un carter acier dure plus longtemps qu'un carter polymère, mais pèse trois à quatre kilos de plus. Sur un terrain plat, c'est indifférent. En pente, cela se sent au bout de vingt minutes.</p>`
	},
	{
		category: 'bien-choisir',
		title: 'Thermique ou batterie : le match sur le terrain',
		excerpt:
			"L'électroportatif a beaucoup progressé. Reste à savoir où il remplace vraiment le thermique, et où il montre encore ses limites.",
		cover: cover('1788610830488-1343095c571c'),
		content: `<h2>Là où la batterie gagne</h2>
<p>Sur les <strong>taille-haies</strong> et les <strong>souffleurs</strong>, l'usage est fractionné : quelques minutes, plusieurs fois. La batterie démarre instantanément, ne réclame aucun entretien de carburation, et le bruit n'impose pas de protection auditive.</p>
<p>Même constat pour les tondeuses jusqu'à 800 m² environ, où une batterie de 5 Ah suffit largement.</p>
<h2>Là où le thermique reste devant</h2>
<p>L'abattage, le débroussaillage de ronces, les grandes surfaces : dès que l'effort est continu et prolongé, l'autonomie devient le facteur limitant. Une tronçonneuse thermique se recharge en trente secondes ; une batterie, en quarante minutes.</p>
<h2>Le vrai calcul</h2>
<p>Le coût d'une machine à batterie se juge sur l'ensemble : deux accumulateurs et un chargeur rapide représentent souvent autant que la machine elle-même. En revanche, rester dans une seule marque permet de mutualiser les batteries sur plusieurs outils.</p>
<h2>Notre avis d'atelier</h2>
<p>Pour un particulier avec un terrain moyen, la batterie couvre aujourd'hui l'essentiel des besoins. Pour un usage professionnel ou un terrain difficile, le thermique garde l'avantage — et se répare plus facilement sur le long terme.</p>`
	},
	{
		category: 'saisons',
		title: 'Feuilles mortes : souffleur, aspirateur ou broyeur ?',
		excerpt:
			'Trois machines, trois usages. Celui qui achète un souffleur pour ramasser se trompe de outil — voici comment choisir.',
		cover: cover('1634081727680-fa43e3237d5a'),
		content: `<h2>Le souffleur : rassembler, pas ramasser</h2>
<p>Il déplace les feuilles vers un point de collecte. Rapide sur les allées, les terrasses et les pelouses dégagées, il devient inefficace dès que le vent se lève ou que les feuilles sont mouillées.</p>
<h2>L'aspirateur : ramasser les petites surfaces</h2>
<p>Il collecte dans un sac, souvent en broyant au passage. Pratique sur une terrasse ou un parterre, mais le sac se remplit vite et le rendement chute sur un grand terrain.</p>
<h2>Le broyeur : réduire le volume</h2>
<p>C'est lui qui transforme le tas en matière utile. Un ratio de réduction de 10 pour 1 est courant, et le broyat fait un excellent paillage pour les massifs.</p>
<h2>Les modèles combinés</h2>
<p>La plupart des appareils actuels cumulent soufflage et aspiration, avec un simple inverseur. C'est le meilleur compromis pour un particulier — à condition de vérifier le <strong>volume du sac</strong> et le <strong>poids en configuration aspiration</strong>, où la machine devient nettement plus lourde.</p>
<blockquote><p>Un conseil d'atelier : ne jamais aspirer de feuilles détrempées. C'est la première cause de bourrage de la turbine.</p></blockquote>`
	}
];

console.log('\n=== Jeu de démonstration du blog ===\n');

const categoryIds = new Map<string, number>();

for (const category of CATEGORIES) {
	const [row] = await sql<{ id: number }[]>`
		INSERT INTO blog_category ${sql({
			name: category.name,
			slug: category.slug,
			color: category.color,
			sort_order: category.sortOrder,
			is_active: true
		})}
		ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`;
	categoryIds.set(category.slug, row.id);
	console.log(`  catégorie  ${category.name}`);
}

// L'auteur doit être un compte **interne** (R5). Filtrer sur « rôle renseigné »
// ne suffit pas : les clients en portent un aussi (`customer`), et le blog
// serait alors signé du nom d'un acheteur.
const [author] = await sql<{ id: string }[]>`
	SELECT id FROM "user" WHERE role = 'admin' ORDER BY created_at LIMIT 1
`;

for (const [index, article] of ARTICLES.entries()) {
	const slug = article.title
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

	// Les dates s'échelonnent sur les dernières semaines : une liste où tout
	// paraît publié le même jour sonne faux.
	const publishedAt = new Date(Date.now() - (index + 1) * 6 * 86_400_000);

	await sql`
		INSERT INTO blog_article ${sql({
			slug,
			title: article.title,
			content_type: 'article',
			content: article.content,
			excerpt: article.excerpt,
			cover_image_url: article.cover,
			blog_category_id: categoryIds.get(article.category)!,
			author_user_id: author?.id ?? null,
			status: 'published',
			published_at: publishedAt
		})}
		ON CONFLICT (slug) DO UPDATE SET
			title = EXCLUDED.title,
			content = EXCLUDED.content,
			excerpt = EXCLUDED.excerpt,
			cover_image_url = EXCLUDED.cover_image_url
	`;
	console.log(`  article    ${article.title.slice(0, 52)}`);
}

console.log(`\n${ARTICLES.length} articles publiés dans ${CATEGORIES.length} catégories.\n`);
await sql.end();
