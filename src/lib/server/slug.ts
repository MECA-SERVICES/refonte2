/** Transforme un texte en slug URL-friendly (minuscules, tirets, sans accents). */
export function slugify(input: string): string {
	return input
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '') // retire les diacritiques combinants (accents)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
