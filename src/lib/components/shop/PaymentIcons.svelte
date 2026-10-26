<script lang="ts">
	/**
	 * Moyens de paiement acceptés, en pictogrammes de carte (demande client
	 * 11.2). Dessinés en SVG : aucune image externe à charger, et une netteté
	 * égale à toutes les tailles.
	 */
	let { class: className = '' }: { class?: string } = $props();
</script>

<ul class="flex flex-wrap gap-1.5 {className}" aria-label="Moyens de paiement acceptés">
	<li>
		<svg viewBox="0 0 48 30" class="h-7 w-auto" role="img" aria-label="Carte bancaire CB">
			<defs>
				<linearGradient id="pay-cb" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stop-color="#1d4f91" />
					<stop offset="1" stop-color="#11a07a" />
				</linearGradient>
			</defs>
			<rect width="48" height="30" rx="4" fill="url(#pay-cb)" />
			<text
				x="24"
				y="20.5"
				text-anchor="middle"
				font-family="Arial, Helvetica, sans-serif"
				font-size="14"
				font-weight="700"
				fill="#fff">CB</text
			>
		</svg>
	</li>
	<li>
		<svg viewBox="0 0 48 30" class="h-7 w-auto" role="img" aria-label="Visa">
			<rect width="48" height="30" rx="4" fill="#fff" />
			<text
				x="24"
				y="20"
				text-anchor="middle"
				font-family="Arial, Helvetica, sans-serif"
				font-size="13"
				font-style="italic"
				font-weight="800"
				fill="#1a1f71">VISA</text
			>
		</svg>
	</li>
	<li>
		<svg viewBox="0 0 48 30" class="h-7 w-auto" role="img" aria-label="Mastercard">
			<rect width="48" height="30" rx="4" fill="#fff" />
			<circle cx="19.5" cy="15" r="8" fill="#eb001b" />
			<circle cx="28.5" cy="15" r="8" fill="#f79e1b" fill-opacity="0.9" />
		</svg>
	</li>
	<li>
		<svg viewBox="0 0 48 30" class="h-7 w-auto" role="img" aria-label="Virement bancaire">
			<rect width="48" height="30" rx="4" fill="#fff" />
			<g fill="none" stroke="#314192" stroke-width="1.6" stroke-linejoin="round">
				<path d="M15 12 24 7l9 5Z" />
				<path d="M17 13v7M21.5 13v7M26.5 13v7M31 13v7M14.5 22h19" />
			</g>
		</svg>
	</li>
	<li>
		<svg viewBox="0 0 48 30" class="h-7 w-auto" role="img" aria-label="Mandat administratif">
			<rect width="48" height="30" rx="4" fill="#fff" />
			<g fill="none" stroke="#314192" stroke-width="1.6" stroke-linejoin="round">
				<path d="M18 6h9l4 4v14H18Z" />
				<path d="M27 6v4h4M21 15h7M21 18.5h7" />
			</g>
		</svg>
	</li>
</ul>
